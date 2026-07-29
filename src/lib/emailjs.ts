import emailjs from '@emailjs/browser'

// NOTE: These are placeholder credentials!
// The user needs to create an account at https://www.emailjs.com/
// and replace these with their actual Service ID, Template ID, and Public Key.
const EMAILJS_SERVICE_ID = 'service_placeholder'
const EMAILJS_TEMPLATE_ID = 'template_placeholder'
const EMAILJS_PUBLIC_KEY = 'public_key_placeholder'

export interface BookingEmailDetails {
  client_name: string
  client_email: string
  service_name: string
  booking_date: string
  start_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
}

export const sendBookingEmail = async (details: BookingEmailDetails) => {
  if (!details.client_email) return

  // Only attempt to send if the user has replaced the placeholders
  if (EMAILJS_SERVICE_ID === 'service_placeholder') {
    console.warn('EmailJS not configured yet. Email would have been sent to:', details.client_email, 'Status:', details.status)
    return
  }

  let statusMessage = ''
  switch (details.status) {
    case 'pending':
      statusMessage = 'Your booking request has been received and is pending confirmation.'
      break
    case 'confirmed':
      statusMessage = 'Great news! Your booking has been confirmed.'
      break
    case 'cancelled':
      statusMessage = 'Your booking has been cancelled. Please contact us to reschedule.'
      break
    case 'completed':
      statusMessage = 'Thank you for your visit! Your booking is now complete.'
      break
  }

  const templateParams = {
    to_name: details.client_name,
    to_email: details.client_email,
    service_name: details.service_name,
    booking_date: details.booking_date,
    start_time: details.start_time,
    status_message: statusMessage,
    reply_to: 'admin@marquevedo.com',
  }

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    )
    console.log(`Email successfully sent to ${details.client_email} for status: ${details.status}`)
  } catch (error) {
    console.error('Failed to send email via EmailJS:', error)
  }
}
