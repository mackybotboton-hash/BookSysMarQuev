import { useState } from 'react'
import { Plus, Trash2, Edit2, X, Wallet } from 'lucide-react'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useGenerateSalary } from '@/hooks/useExpenses'
import { useActiveStaff } from '@/hooks/useStaff'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { value: 'salary', label: 'Salary', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'supplies', label: 'Supplies', color: 'bg-blue-100 text-blue-700' },
  { value: 'rent', label: 'Rent', color: 'bg-purple-100 text-purple-700' },
  { value: 'utilities', label: 'Utilities', color: 'bg-orange-100 text-orange-700' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700' },
]

export default function Expenses() {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showSalaryForm, setShowSalaryForm] = useState(false)
  const [editExpense, setEditExpense] = useState<any>(null)

  const { data: expenses, isLoading } = useExpenses({
    category: categoryFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })
  const { data: staffList } = useActiveStaff()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const generateSalary = useGenerateSalary()

  const now = new Date()
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'other' as const,
    expense_date: todayLocal,
    staff_id: '',
  })

  const [salaryForm, setSalaryForm] = useState({
    staff_id: '',
    days_worked: '1',
    date: todayLocal,
  })

  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0

  const openCreate = () => {
    setEditExpense(null)
    const now = new Date()
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    setForm({ description: '', amount: '', category: 'other', expense_date: todayLocal, staff_id: '' })
    setShowForm(true)
  }

  const openEdit = (exp: any) => {
    setEditExpense(exp)
    setForm({
      description: exp.description,
      amount: exp.amount.toString(),
      category: exp.category,
      expense_date: exp.expense_date,
      staff_id: exp.staff_id || '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description || !form.amount) {
      toast.error('Description and amount required')
      return
    }
    try {
      if (editExpense) {
        await updateExpense.mutateAsync({
          id: editExpense.id,
          updates: {
            description: form.description,
            amount: parseFloat(form.amount),
            category: form.category,
            expense_date: form.expense_date,
            staff_id: form.staff_id || null,
          },
        })
        toast.success('Expense updated!')
      } else {
        await createExpense.mutateAsync({
          description: form.description,
          amount: parseFloat(form.amount),
          category: form.category,
          expense_date: form.expense_date,
          staff_id: form.staff_id || null,
        })
        toast.success('Expense added!')
      }
      setShowForm(false)
    } catch (err: any) {
      toast.error(err.message || 'Error saving')
    }
  }

  const handleSalary = async (e: React.FormEvent) => {
    e.preventDefault()
    const staff = staffList?.find(s => s.id === salaryForm.staff_id)
    if (!staff) {
      toast.error('Please select a staff member')
      return
    }
    try {
      await generateSalary.mutateAsync({
        staffId: staff.id,
        staffName: staff.name,
        dailyRate: staff.daily_rate,
        daysWorked: parseInt(salaryForm.days_worked),
        date: salaryForm.date,
      })
      toast.success(`Salary generated: ${formatCurrency(staff.daily_rate * parseInt(salaryForm.days_worked))}`)
      setShowSalaryForm(false)
    } catch (err: any) {
      toast.error(err.message || 'Error generating salary')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    try {
      await deleteExpense.mutateAsync(id)
      toast.success('Expense deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const getCategoryStyle = (cat: string) => CATEGORIES.find(c => c.value === cat)?.color || 'bg-gray-100 text-gray-700'

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-field w-auto min-w-[140px]">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field w-auto" placeholder="From" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field w-auto" placeholder="To" />
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setShowSalaryForm(true)} className="btn-gold flex items-center gap-2 text-sm whitespace-nowrap">
            <Wallet size={16} /> Generate Salary
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Total Summary */}
      <div className="card-premium p-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">Total Expenses (filtered)</span>
        <span className="font-heading font-bold text-xl text-emerald">{formatCurrency(totalExpenses)}</span>
      </div>

      {/* Expenses Table */}
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left p-3 font-medium text-gray-500">Description</th>
                <th className="text-left p-3 font-medium text-gray-500">Category</th>
                <th className="text-left p-3 font-medium text-gray-500 hidden sm:table-cell">Staff</th>
                <th className="text-left p-3 font-medium text-gray-500">Date</th>
                <th className="text-right p-3 font-medium text-gray-500">Amount</th>
                <th className="text-right p-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-3"><div className="skeleton h-10 w-full" /></td></tr>
                ))
              ) : expenses?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No expenses found</td></tr>
              ) : (
                expenses?.map((exp: any) => (
                  <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 font-medium text-charcoal">{exp.description}</td>
                    <td className="p-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full font-medium', getCategoryStyle(exp.category))}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-gray-600">{exp.staff?.name || '—'}</td>
                    <td className="p-3 text-gray-600">{formatDate(exp.expense_date)}</td>
                    <td className="p-3 text-right font-medium text-charcoal">{formatCurrency(exp.amount)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(exp)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-heading font-bold text-lg">{editExpense ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Description *</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount (₱) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="input-field" min="0" step="0.01" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as any }))} className="input-field">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Staff (optional)</label>
                  <select value={form.staff_id} onChange={e => setForm(p => ({ ...p, staff_id: e.target.value }))} className="input-field">
                    <option value="">None</option>
                    {staffList?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 btn-primary text-sm" disabled={createExpense.isPending || updateExpense.isPending}>{editExpense ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Generator Modal */}
      {showSalaryForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-heading font-bold text-lg">Generate Salary</h3>
              <button onClick={() => setShowSalaryForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSalary} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Staff Member *</label>
                <select value={salaryForm.staff_id} onChange={e => setSalaryForm(p => ({ ...p, staff_id: e.target.value }))} className="input-field" required>
                  <option value="">Select staff</option>
                  {staffList?.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.daily_rate)}/day)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Days Worked</label>
                  <input type="number" value={salaryForm.days_worked} onChange={e => setSalaryForm(p => ({ ...p, days_worked: e.target.value }))} className="input-field" min="1" max="31" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
                  <input type="date" value={salaryForm.date} onChange={e => setSalaryForm(p => ({ ...p, date: e.target.value }))} className="input-field" />
                </div>
              </div>
              {salaryForm.staff_id && (
                <div className="bg-gold/5 border border-gold/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Computed Salary</p>
                  <p className="font-heading font-bold text-xl text-emerald mt-1">
                    {formatCurrency((staffList?.find(s => s.id === salaryForm.staff_id)?.daily_rate || 0) * parseInt(salaryForm.days_worked || '0'))}
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSalaryForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 btn-gold text-sm" disabled={generateSalary.isPending}>Generate</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
