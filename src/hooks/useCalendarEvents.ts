import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent } from '@/lib/database.types'

const STORAGE_KEY = 'marquevedo_calendar_events'

const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('marquevedo_calendar_events_bc')
  : null

if (bc) {
  bc.onmessage = (msg) => {
    if (msg.data?.type === 'SYNC_EVENTS') {
      try {
        const evt = msg.data.evt
        if (evt) {
          const existing = getLocalCalendarEvents()
          const updated = [evt, ...existing.filter(e => e.id !== evt.id)]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        }
        window.dispatchEvent(new Event('calendar-events-updated'))
      } catch (e) {}
    } else if (msg.data?.type === 'DELETE_EVENT') {
      try {
        const id = msg.data.id
        if (id) {
          const existing = getLocalCalendarEvents()
          const updated = existing.filter(e => e.id !== id)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        }
        window.dispatchEvent(new Event('calendar-events-updated'))
      } catch (e) {}
    }
  }
}

export function getLocalCalendarEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export function saveLocalCalendarEvent(evt: CalendarEvent) {
  try {
    const cleanEvt = {
      ...evt,
      event_date: evt.event_date ? String(evt.event_date).substring(0, 10) : '',
    }
    const existing = getLocalCalendarEvents()
    const updated = [cleanEvt, ...existing.filter(e => e.id !== cleanEvt.id)]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new Event('calendar-events-updated'))
    window.dispatchEvent(new Event('storage'))
    bc?.postMessage({ type: 'SYNC_EVENTS', evt: cleanEvt })
  } catch (e) {
    console.error(e)
  }
}

export function removeLocalCalendarEvent(id: string) {
  try {
    const existing = getLocalCalendarEvents()
    const updated = existing.filter(e => e.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new Event('calendar-events-updated'))
    window.dispatchEvent(new Event('storage'))
    bc?.postMessage({ type: 'DELETE_EVENT', id })
  } catch (e) {
    console.error(e)
  }
}

type CalendarEventInsert = {
  title: string
  event_date: string
  is_all_day: boolean
  start_time?: string | null
  end_time?: string | null
  notes?: string
  created_by?: string | null
}

export function useCalendarEvents(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['calendarEvents', startDate, endDate],
    queryFn: async (): Promise<CalendarEvent[]> => {
      let dbData: CalendarEvent[] = []
      const cleanStart = startDate ? String(startDate).substring(0, 10) : ''
      const cleanEnd = endDate ? String(endDate).substring(0, 10) : ''

      try {
        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
        if (error) {
          console.warn('Supabase calendar_events select error:', error.message)
        } else if (data) {
          dbData = data as CalendarEvent[]
        }
      } catch (err) {
        console.warn('Supabase calendar_events query warning:', err)
      }

      const localData = getLocalCalendarEvents()

      const map = new Map<string, CalendarEvent>()
      localData.forEach(e => map.set(e.id, e))
      dbData.forEach(e => map.set(e.id, e))

      const allEvents = Array.from(map.values())
      return allEvents.filter(e => {
        if (!e.event_date) return false
        const d = String(e.event_date).substring(0, 10)
        return d >= cleanStart && d <= cleanEnd
      })
    },
    enabled: !!startDate && !!endDate,
    refetchInterval: 1000,
  })
}

export function useCalendarEventsByDate(date: string) {
  return useQuery({
    queryKey: ['calendarEventsByDate', date],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const targetDate = date ? String(date).substring(0, 10) : ''
      if (!targetDate) return []

      let dbData: CalendarEvent[] = []
      try {
        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
        if (error) {
          console.warn('Supabase calendar_events date query error:', error.message)
        } else if (data) {
          dbData = data as CalendarEvent[]
        }
      } catch (err) {
        console.warn('Supabase calendar_events date query warning:', err)
      }

      const localData = getLocalCalendarEvents()

      const map = new Map<string, CalendarEvent>()
      localData.forEach(e => map.set(e.id, e))
      dbData.forEach(e => map.set(e.id, e))

      const allEvents = Array.from(map.values())

      return allEvents.filter(e => {
        if (!e.event_date) return false
        const eDateStr = String(e.event_date).substring(0, 10)
        return eDateStr === targetDate
      })
    },
    enabled: !!date,
    refetchInterval: 1000, // 1-second instant real-time polling
  })
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (event: CalendarEventInsert) => {
      const cleanDate = event.event_date ? String(event.event_date).substring(0, 10) : ''
      const newId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      const newEvt: CalendarEvent = {
        id: newId,
        title: event.title,
        event_date: cleanDate,
        is_all_day: event.is_all_day,
        start_time: event.start_time || null,
        end_time: event.end_time || null,
        notes: event.notes || '',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Save to localStorage & BroadcastChannel
      saveLocalCalendarEvent(newEvt)

      try {
        const payload: any = {
          title: event.title,
          event_date: cleanDate,
          is_all_day: event.is_all_day,
          start_time: event.start_time || null,
          end_time: event.end_time || null,
          notes: event.notes || '',
        }
        const { data, error } = await supabase
          .from('calendar_events')
          .insert(payload)
          .select()
          .maybeSingle()

        if (error) {
          console.error('Supabase calendar_events insert error:', error)
        } else if (data) {
          removeLocalCalendarEvent(newEvt.id) // Remove temporary event
          saveLocalCalendarEvent(data as CalendarEvent) // Save real event
          return data
        }
      } catch (err) {
        console.warn('Supabase insert exception:', err)
      }

      return newEvt
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] })
      queryClient.invalidateQueries({ queryKey: ['calendarEventsByDate'] })
    },
  })
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      removeLocalCalendarEvent(id)
      try {
        await supabase
          .from('calendar_events')
          .delete()
          .eq('id', id)
      } catch (err) {
        console.warn('Supabase delete warning:', err)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] })
      queryClient.invalidateQueries({ queryKey: ['calendarEventsByDate'] })
    },
  })
}
