import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from 'firebase/firestore'
import { type User as AuthUser, onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import {
  Calendar,
  CalendarDays,
  CheckCircle,
  Clock,
  History,
  ListChecks,
  Lock,
  Phone,
  Search,
  Stethoscope,
  Trash2,
  User,
} from 'lucide-react'
import { auth, db } from './firebase'

const ADMIN_PASSWORD = 'admin123'
const WORK_DAY_INDEX = 4
const START_MINUTES = 16 * 60
const END_MINUTES = 18 * 60 + 30
const SLOT_STEP_MINUTES = 30

type Lang = 'ar' | 'he'

const SERVICE_KEYS = ['ultrasound', 'iud', 'pregnancy_exam', 'pregnancy_followup', 'lab_tests'] as const
type ServiceKey = (typeof SERVICE_KEYS)[number]

type TranslationsShape = {
  clinicName: string
  clinicSubtitle: string
  clinicServicesTitle: string
  clinicServicesList: string[]
  clinicReceptionDaysLabel: string
  clinicReceptionDaysValue: string
  clinicWorkingHoursLabel: string
  clinicWorkingHoursValue: string
  adminTooltip: string
  backToBooking: string
  bookingTitle: string
  bookingSubtitle: string
  dateLabel: string
  thursdayNote: string
  timeLabel: string
  timePlaceholder: string
  serviceLabel: string
  servicePlaceholder: string
  serviceOptions: Record<ServiceKey, string>
  nameLabel: string
  namePlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  bookNow: string
  thursdayAlert: string
  timeRangeAlert: string
  successBooked: string
  slotTaken: string
  waitAuth: string
  notSignedIn: string
  authOpNotAllowed: string
  authErrorPrefix: string
  authErrorGeneric: string
  bookingErrorPrefix: string
  loading: string
  adminLoginTitle: string
  passwordPlaceholder: string
  loginButton: string
  dashboardTitle: string
  todayTab: string
  upcomingTab: string
  completedTab: string
  searchPlaceholder: string
  noneFound: string
  confirmDelete: string
  markDone: string
  deleteAppointment: string
  footer: string
  errors: {
    permissionDenied: string
    unauthenticated: string
    failedPrecondition: string
    resourceExhausted: string
    firebasePrefix: string
    unknown: string
  }
}

const he: TranslationsShape = {
  clinicName: 'המרכז הרפואי תל שבע ',
  clinicSubtitle: 'מרפאת נשים מומחית',
  clinicServicesTitle: 'השירותים הניתנים במרפאה:',
  clinicServicesList: [
    'אולטרסאונד צבעוני (U/S)',
    'התקנת התקן תוך רחמי למניעת הריון',
    'בדיקת הריון מקיפה',
    'מעקב וטיפול מלא לאורך כל ההריון',
    'בדיקות דם, שתן וסוכר',
  ],
  clinicReceptionDaysLabel: 'ימי קבלה:',
  clinicReceptionDaysValue: 'חמישי',
  clinicWorkingHoursLabel: 'שעות עבודה:',
  clinicWorkingHoursValue: '16:00 - 18:30',
  adminTooltip: 'ניהול מערכת',
  backToBooking: 'חזרה לזימון',
  bookingTitle: 'זימון תור חדש',
  bookingSubtitle: 'מלאי את הפרטים ונחזור אלייך לאישור',
  dateLabel: 'בחרי יום (חמישי בלבד)',
  thursdayNote: 'שימי לב: המרפאה מקבלת רק בימי חמישי',
  timeLabel: 'בחרי שעה',
  timePlaceholder: 'בחרי שעה...',
  serviceLabel: 'סיבת התור',
  servicePlaceholder: 'בחרי שירות...',
  serviceOptions: {
    ultrasound: 'אולטרסאונד צבעוני (U/S)',
    iud: 'התקנת התקן תוך רחמי',
    pregnancy_exam: 'בדיקת הריון מקיפה',
    pregnancy_followup: 'מעקב וטיפול בהריון',
    lab_tests: 'בדיקות דם/שתן/סוכר',
  },
  nameLabel: 'שם מלא',
  namePlaceholder: 'ישראל ישראלית',
  phoneLabel: 'מספר טלפון',
  phonePlaceholder: '050-0000000',
  bookNow: 'קבעי תור עכשיו',
  thursdayAlert: 'מרפאה פעילה בימי חמישי בלבד.',
  timeRangeAlert: 'ניתן לקבוע תור רק בין 16:00 ל-18:30 (כל חצי שעה).',
  successBooked: 'התור נקבע בהצלחה! נתראה בקרוב.',
  slotTaken: 'השעה הזו כבר נתפסה. בחרי שעה אחרת.',
  waitAuth: 'ממתין להתחברות... נסי שוב בעוד רגע',
  notSignedIn: 'משתמש לא מחובר. ודאי ש-Anonymous Auth מופעל ב-Firebase Console',
  authOpNotAllowed: 'שגיאת התחברות: יש להפעיל Anonymous Sign-in ב-Firebase Console',
  authErrorPrefix: 'שגיאת התחברות:',
  authErrorGeneric: 'שגיאת התחברות',
  bookingErrorPrefix: 'שגיאה בקביעת התור:',
  loading: 'טוען...',
  adminLoginTitle: 'כניסת מנהלת',
  passwordPlaceholder: 'הזיני סיסמה...',
  loginButton: 'כניסה למערכת',
  dashboardTitle: 'לוח תורים',
  todayTab: 'היום',
  upcomingTab: 'עתידיים',
  completedTab: 'טופלו',
  searchPlaceholder: 'חיפוש מטופלת...',
  noneFound: 'לא נמצאו תורים בקטגוריה זו',
  confirmDelete: 'למחוק את התור?',
  markDone: 'סמן כבוצע',
  deleteAppointment: 'מחיקת תור',
  footer: 'כל הזכויות שמורות',
  errors: {
    permissionDenied: 'אין הרשאה לכתוב ל-Firestore (בדוק Rules + Publish, וודא שאת על אותו פרויקט Firebase)',
    unauthenticated: 'משתמש לא מחובר (בדוק Anonymous Auth)',
    failedPrecondition: 'שגיאת Firestore: ייתכן שחסר אינדקס/הגדרה',
    resourceExhausted: 'חריגה ממגבלות Firestore (נסה שוב מאוחר יותר)',
    firebasePrefix: 'שגיאת Firebase:',
    unknown: 'שגיאה לא ידועה',
  },
}

const ar: TranslationsShape = {
  clinicName: 'المركز الطبي تل السبع',
  clinicSubtitle: 'عيادة نسائية متخصصة',
  clinicServicesTitle: 'نقدّم الخدمات التالية:',
  clinicServicesList: [
    'تصوير تلفزيوني ملوّن (U/S)',
    'تركيب لولب لمنع الحمل',
    'فحص حمل شامل',
    'متابعة وعناية متكاملة طوال فترة الحمل',
    'فحوصات دم، بول، وسكر',
  ],
  clinicReceptionDaysLabel: 'أيام الاستقبال:',
  clinicReceptionDaysValue: 'الخميس',
  clinicWorkingHoursLabel: 'ساعات العمل:',
  clinicWorkingHoursValue: '16:00 - 18:30',
  adminTooltip: 'إدارة النظام',
  backToBooking: 'العودة للحجز',
  bookingTitle: 'حجز موعد جديد',
  bookingSubtitle: 'املئي التفاصيل وسنتواصل معك للتأكيد',
  dateLabel: 'اختاري يومًا (الخميس فقط)',
  thursdayNote: 'ملاحظة: العيادة تستقبل فقط يوم الخميس',
  timeLabel: 'اختاري الساعة',
  timePlaceholder: 'اختاري الساعة...',
  serviceLabel: 'سبب الموعد',
  servicePlaceholder: 'اختاري خدمة...',
  serviceOptions: {
    ultrasound: 'تصوير تلفزيوني ملوّن (U/S)',
    iud: 'تركيب لولب لمنع الحمل',
    pregnancy_exam: 'فحص حمل شامل',
    pregnancy_followup: 'متابعة وعناية متكاملة طوال فترة الحمل',
    lab_tests: 'فحوصات دم، بول، وسكر',
  },
  nameLabel: 'الاسم الكامل',
  namePlaceholder: 'مثال: سارة أحمد',
  phoneLabel: 'رقم الهاتف',
  phonePlaceholder: '050-0000000',
  bookNow: 'احجزي الموعد الآن',
  thursdayAlert: 'العيادة تعمل يوم الخميس فقط.',
  timeRangeAlert: 'يمكن حجز موعد فقط بين 16:00 و 18:30 (كل 30 دقيقة).',
  successBooked: 'تم حجز الموعد بنجاح! نراك قريبًا.',
  slotTaken: 'هذه الساعة محجوزة. اختاري ساعة أخرى.',
  waitAuth: 'جاري تسجيل الدخول... حاولي بعد لحظة',
  notSignedIn: 'المستخدم غير مسجل. تأكدي من تفعيل Anonymous Auth في Firebase',
  authOpNotAllowed: 'خطأ تسجيل الدخول: يجب تفعيل Anonymous Sign-in في Firebase',
  authErrorPrefix: 'خطأ تسجيل الدخول:',
  authErrorGeneric: 'خطأ في تسجيل الدخول',
  bookingErrorPrefix: 'خطأ في حجز الموعد:',
  loading: 'جارٍ التحميل...',
  adminLoginTitle: 'دخول الإدارة',
  passwordPlaceholder: 'أدخلي كلمة المرور...',
  loginButton: 'دخول',
  dashboardTitle: 'لوحة المواعيد',
  todayTab: 'اليوم',
  upcomingTab: 'القادمة',
  completedTab: 'تمت',
  searchPlaceholder: 'بحث عن مريضة...',
  noneFound: 'لا توجد مواعيد في هذه الفئة',
  confirmDelete: 'هل تريد حذف الموعد؟',
  markDone: 'وضع كمنجز',
  deleteAppointment: 'حذف الموعد',
  footer: 'جميع الحقوق محفوظة',
  errors: {
    permissionDenied: 'لا توجد صلاحية للكتابة في Firestore (تحقق من Rules + Publish ومن نفس مشروع Firebase)',
    unauthenticated: 'المستخدم غير مسجل (تحقق من Anonymous Auth)',
    failedPrecondition: 'خطأ Firestore: قد يكون هناك إعداد/فهرس ناقص',
    resourceExhausted: 'تم تجاوز حدود Firestore (حاول لاحقًا)',
    firebasePrefix: 'خطأ Firebase:',
    unknown: 'خطأ غير معروف',
  },
}

const translations: Record<Lang, TranslationsShape> = { he, ar }
type T = TranslationsShape

type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled'

type Appointment = {
  id: string
  date: string
  time: string
  service: ServiceKey | string
  name: string
  phone: string
  status: AppointmentStatus
  createdAt?: string
}

function parseIsoDateLocal(dateString: string) {
  const [y, m, d] = dateString.split('-').map((x) => Number(x))
  return new Date(y, m - 1, d)
}

function formatLocalDateISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isThursdayDate(dateString: string) {
  const d = parseIsoDateLocal(dateString)
  return d.getDay() === WORK_DAY_INDEX
}

function timeToMinutes(time: string) {
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN
  return h * 60 + m
}

function isValidClinicSlot(date: string, time: string) {
  if (!isThursdayDate(date)) return false
  const minutesOfDay = timeToMinutes(time)
  if (!Number.isFinite(minutesOfDay)) return false
  if (minutesOfDay < START_MINUTES || minutesOfDay > END_MINUTES) return false
  return (minutesOfDay - START_MINUTES) % SLOT_STEP_MINUTES === 0
}

function slotId(date: string, time: string) {
  return `${date}_${time.replace(':', '')}`
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [view, setView] = useState<'booking' | 'admin-login' | 'admin-dashboard'>('booking')
  const [bookingLang, setBookingLang] = useState<Lang>('ar')
  const [adminLang, setAdminLang] = useState<Lang>('he')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const currentLang = view === 'booking' ? bookingLang : adminLang
  const t: T = translations[currentLang]
  const setCurrentLang = (lang: Lang) => {
    if (view === 'booking') setBookingLang(lang)
    else setAdminLang(lang)
  }

  useEffect(() => {
    document.documentElement.lang = currentLang
    document.documentElement.dir = 'rtl'
  }, [currentLang])

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth)
      } catch (error) {
        console.error('Auth error:', error)
        if (error instanceof FirebaseError) {
          if (error.code === 'auth/operation-not-allowed') {
            showMessage(translations.ar.authOpNotAllowed, 'error')
          } else {
            showMessage(`${translations.ar.authErrorPrefix} ${error.code}`, 'error')
          }
        } else {
          showMessage(translations.ar.authErrorGeneric, 'error')
        }
      }
    }

    initAuth()
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return

    const appointmentsRef = collection(db, 'appointments')
    const unsubscribe = onSnapshot(
      appointmentsRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }))
        setAppointments(data)
        setLoading(false)
      },
      (error) => {
        console.error('Firestore error:', error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user])

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    window.setTimeout(() => setMessage(null), 5000)
  }

  const describeFirebaseError = (error: unknown) => {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'permission-denied':
          return t.errors.permissionDenied
        case 'unauthenticated':
          return t.errors.unauthenticated
        case 'failed-precondition':
          return t.errors.failedPrecondition
        case 'resource-exhausted':
          return t.errors.resourceExhausted
        default:
          return `${t.errors.firebasePrefix} ${error.code}`
      }
    }

    if (error instanceof Error) return error.message
    return t.errors.unknown
  }

  const handleAddAppointment = async (appointmentData: Omit<Appointment, 'id' | 'status' | 'createdAt'>) => {
    if (!isValidClinicSlot(appointmentData.date, appointmentData.time)) {
      if (!isThursdayDate(appointmentData.date)) showMessage(t.thursdayAlert, 'error')
      else showMessage(t.timeRangeAlert, 'error')
      return
    }

    if (!authReady) {
      showMessage(t.waitAuth, 'error')
      return
    }

    if (!user) {
      showMessage(t.notSignedIn, 'error')
      return
    }

    const appointmentsRef = collection(db, 'appointments')

    try {
      const id = slotId(appointmentData.date, appointmentData.time)
      const docRef = doc(appointmentsRef, id)

      await runTransaction(db, async (tx) => {
        const existing = await tx.get(docRef)
        if (existing.exists()) {
          const existingData = existing.data() as { status?: AppointmentStatus }
          if (existingData.status !== 'cancelled') {
            throw new Error('slot_taken')
          }
        }

        tx.set(docRef, {
          ...appointmentData,
          status: 'upcoming' as const,
          createdAt: new Date().toISOString(),
        })
      })

      showMessage(t.successBooked)
    } catch (error) {
      if (error instanceof Error && error.message === 'slot_taken') {
        showMessage(t.slotTaken, 'error')
        return
      }
      console.error(error)
      showMessage(`${t.bookingErrorPrefix} ${describeFirebaseError(error)}`, 'error')
    }
  }

  const updateStatus = async (id: string, newStatus: AppointmentStatus) => {
    try {
      const docRef = doc(db, 'appointments', id)
      await updateDoc(docRef, { status: newStatus })
    } catch (error) {
      console.error(error)
    }
  }

  const deleteAppointment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'appointments', id))
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900" dir="rtl">
      <nav className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
            <Stethoscope size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-rose-700">{t.clinicName}</h1>
            <p className="text-xs text-slate-500">{t.clinicSubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div dir="ltr" className="flex items-center bg-slate-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => setCurrentLang('ar')}
              className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                currentLang === 'ar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="العربية"
            >
              ع
            </button>
            <button
              type="button"
              onClick={() => setCurrentLang('he')}
              className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                currentLang === 'he' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="עברית"
            >
              ע
            </button>
          </div>

          {view === 'booking' ? (
            <button
              onClick={() => setView('admin-login')}
              className="text-slate-400 hover:text-rose-600 transition-colors p-2"
              title={t.adminTooltip}
            >
              <Lock size={18} />
            </button>
          ) : (
            <button
              onClick={() => setView('booking')}
              className="text-sm font-medium text-rose-600 hover:bg-rose-50 px-3 py-1 rounded-full transition-colors"
            >
              {t.backToBooking}
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}
          >
            <CheckCircle size={20} />
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl p-8 border border-slate-100 text-center text-slate-500">{t.loading}</div>
        ) : null}

        {view === 'booking' && <BookingForm onAdd={handleAddAppointment} appointments={appointments} t={t} />}
        {view === 'admin-login' && <AdminLogin onLogin={() => setView('admin-dashboard')} t={t} />}
        {view === 'admin-dashboard' && (
          <AdminDashboard appointments={appointments} onUpdateStatus={updateStatus} onDelete={deleteAppointment} t={t} />
        )}
      </main>

      <footer className="py-8 text-center text-slate-400 text-sm border-t border-slate-200">
        <p>
          © {new Date().getFullYear()} {t.clinicName} - {t.footer}
        </p>
      </footer>
    </div>
  )
}

function BookingForm({
  onAdd,
  appointments,
  t,
}: {
  onAdd: (data: Omit<Appointment, 'id' | 'status' | 'createdAt'>) => void
  appointments: Appointment[]
  t: T
}) {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    service: '' as ServiceKey | '',
    name: '',
    phone: '',
  })

  const [availableTimes, setAvailableTimes] = useState<string[]>([])

  const minDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatLocalDateISO(d)
  }

  useEffect(() => {
    if (!formData.date) {
      setAvailableTimes([])
      return
    }

    const times: string[] = []
    for (let minutesOfDay = START_MINUTES; minutesOfDay <= END_MINUTES; minutesOfDay += SLOT_STEP_MINUTES) {
      const h = Math.floor(minutesOfDay / 60)
      const m = minutesOfDay % 60
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const taken = appointments.some(
        (app) => app.date === formData.date && app.time === timeStr && app.status !== 'cancelled',
      )
      if (!taken) times.push(timeStr)
    }
    setAvailableTimes(times)
  }, [formData.date, appointments])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isThursdayDate(formData.date)) {
      window.alert(t.thursdayAlert)
      return
    }

    if (!isValidClinicSlot(formData.date, formData.time)) {
      window.alert(t.timeRangeAlert)
      return
    }

    onAdd({
      date: formData.date,
      time: formData.time,
      service: formData.service,
      name: formData.name,
      phone: formData.phone,
    })

    setFormData({ date: '', time: '', service: '', name: '', phone: '' })
  }

  return (
    <div className="space-y-6">
   

      <div className="bg-white rounded-2xl shadow-xl shadow-rose-100/50 border border-rose-50 overflow-hidden">
        <div className="bg-rose-600 p-6 text-white">
          <h2 className="text-2xl font-bold mb-1">{t.bookingTitle}</h2>
          <p className="text-rose-100 opacity-90">{t.bookingSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Calendar size={16} className="text-rose-500" />
                {t.dateLabel}
              </label>
              <input
                type="date"
                required
                min={minDate()}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
              />
              {formData.date && !isThursdayDate(formData.date) ? (
                <p className="text-rose-500 text-xs mt-1">{t.thursdayNote}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Clock size={16} className="text-rose-500" />
                {t.timeLabel}
              </label>
              <select
                required
                disabled={!formData.date || !isThursdayDate(formData.date)}
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all disabled:opacity-50"
              >
                <option value="">{t.timePlaceholder}</option>
                {availableTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Stethoscope size={16} className="text-rose-500" />
                {t.serviceLabel}
              </label>
              <select
                required
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value as ServiceKey })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
              >
                <option value="">{t.servicePlaceholder}</option>
                {SERVICE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t.serviceOptions[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <User size={16} className="text-rose-500" />
                {t.nameLabel}
              </label>
              <input
                type="text"
                required
                placeholder={t.namePlaceholder}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Phone size={16} className="text-rose-500" />
                {t.phoneLabel}
              </label>
              <input
                type="tel"
                required
                placeholder={t.phonePlaceholder}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-rose-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {t.bookNow}
          </button>
        </form>
      </div>
    </div>
  )
}

function AdminLogin({ onLogin, t }: { onLogin: () => void; t: T }) {
  const [pass, setPass] = useState('')
  const [error, setError] = useState(false)

  const handleLogin = (e: FormEvent) => {
    e.preventDefault()
    if (pass === ADMIN_PASSWORD) {
      onLogin()
    } else {
      setError(true)
      window.setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-4">
        <Lock size={32} />
      </div>
      <h2 className="text-xl font-bold mb-6 text-slate-800">{t.adminLoginTitle}</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="password"
          placeholder={t.passwordPlaceholder}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className={`w-full p-3 rounded-xl border outline-none transition-all ${
            error ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200 focus:border-rose-500'
          }`}
        />
        <button className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 rounded-xl transition-colors">
          {t.loginButton}
        </button>
      </form>
    </div>
  )
}

function AdminDashboard({
  appointments,
  onUpdateStatus,
  onDelete,
  t,
}: {
  appointments: Appointment[]
  onUpdateStatus: (id: string, status: AppointmentStatus) => void
  onDelete: (id: string) => void
  t: T
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed'>('upcoming')

  const todayStr = formatLocalDateISO(new Date())

  const filteredData = useMemo(() => {
    return appointments
      .filter((app) => {
        const matchesSearch =
          app.name.toLowerCase().includes(searchTerm.toLowerCase()) || app.phone.includes(searchTerm)

        if (!matchesSearch) return false

        if (activeTab === 'today') return app.date === todayStr && app.status !== 'completed'
        if (activeTab === 'upcoming') return app.date > todayStr && app.status !== 'completed'
        if (activeTab === 'completed') return app.status === 'completed'

        return true
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      })
  }, [appointments, activeTab, searchTerm, todayStr])

  const tabs = [
    { id: 'today', label: t.todayTab, icon: CalendarDays },
    { id: 'upcoming', label: t.upcomingTab, icon: ListChecks },
    { id: 'completed', label: t.completedTab, icon: History },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          {t.dashboardTitle}
          <span className="bg-rose-100 text-rose-600 text-sm px-2 py-0.5 rounded-full">{appointments.length}</span>
        </h2>

        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
          />
        </div>
      </div>

      <div className="flex p-1 bg-slate-200/50 rounded-xl max-w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredData.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-dashed border-slate-300">
            <p className="text-slate-400">{t.noneFound}</p>
          </div>
        ) : (
          filteredData.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-xl border border-slate-100 p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      app.status === 'completed' ? 'bg-slate-100 text-slate-400' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{app.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Phone size={14} /> {app.phone}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-rose-600">
                        <Calendar size={14} /> {app.date.split('-').reverse().join('/')}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-rose-600">
                        <Clock size={14} /> {app.time}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded uppercase font-medium">
                        {t.serviceOptions[app.service as ServiceKey] ?? app.service}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {app.status !== 'completed' ? (
                    <button
                      onClick={() => onUpdateStatus(app.id, 'completed')}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title={t.markDone}
                    >
                      <CheckCircle size={22} />
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      if (window.confirm(t.confirmDelete)) onDelete(app.id)
                    }}
                    className="p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                    title={t.deleteAppointment}
                  >
                    <Trash2 size={22} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
