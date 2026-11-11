import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import {
  Bell, BarChart3, ClipboardList, FileText, Gift, History, Inbox, LayoutDashboard, Layers, Megaphone,
  ScrollText, Settings, Shuffle, Sparkles, Trophy, User, Users,
} from 'lucide-react'
import { Spinner } from '@/components/ui'
import PublicLayout from '@/layouts/PublicLayout'
import AuthLayout from '@/layouts/AuthLayout'
import DashboardLayout from '@/layouts/DashboardLayout'
import { GuestRoute, ProtectedRoute, UserRoute } from './guards'

// Public
const Home = lazy(() => import('@/pages/public/Home'))
const Campaigns = lazy(() => import('@/pages/public/Campaigns'))
const CampaignDetails = lazy(() => import('@/pages/public/CampaignDetails'))
const About = lazy(() => import('@/pages/public/About'))
const Winners = lazy(() => import('@/pages/public/Winners'))
const DrawAudit = lazy(() => import('@/pages/public/DrawAudit'))
const HowItWorks = lazy(() => import('@/pages/public/HowItWorks'))
const FAQs = lazy(() => import('@/pages/public/FAQs'))
const Contact = lazy(() => import('@/pages/public/Contact'))
const Terms = lazy(() => import('@/pages/public/Terms'))
const Privacy = lazy(() => import('@/pages/public/Privacy'))
const NotFound = lazy(() => import('@/pages/public/NotFound'))
// Auth
const Login = lazy(() => import('@/pages/auth/Login'))
const Register = lazy(() => import('@/pages/auth/Register'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'))
const AuthCallback = lazy(() => import('@/pages/auth/AuthCallback'))
// User
const UserOverview = lazy(() => import('@/pages/user/Overview'))
const UserProfile = lazy(() => import('@/pages/user/Profile'))
const UserCampaigns = lazy(() => import('@/pages/user/AvailableCampaigns'))
const UserEntries = lazy(() => import('@/pages/user/MyEntries'))
const UserDrawHistory = lazy(() => import('@/pages/user/DrawHistory'))
const UserNotifications = lazy(() => import('@/pages/user/Notifications'))
const UserSettings = lazy(() => import('@/pages/user/AccountSettings'))
// Admin
const AdminOverview = lazy(() => import('@/pages/admin/Overview'))
const AdminUsers = lazy(() => import('@/pages/admin/Users'))
const AdminUserDetail = lazy(() => import('@/pages/admin/UserDetail'))
const AdminCategories = lazy(() => import('@/pages/admin/Categories'))
const AdminCampaigns = lazy(() => import('@/pages/admin/Campaigns'))
const AdminEntries = lazy(() => import('@/pages/admin/Entries'))
const AdminDraws = lazy(() => import('@/pages/admin/Draws'))
const AdminWinners = lazy(() => import('@/pages/admin/Winners'))
const AdminNotifications = lazy(() => import('@/pages/admin/Notifications'))
const AdminMessages = lazy(() => import('@/pages/admin/Messages'))
const AdminReports = lazy(() => import('@/pages/admin/Reports'))
const AdminLogs = lazy(() => import('@/pages/admin/ActivityLogs'))
const AdminSettings = lazy(() => import('@/pages/admin/Settings'))

const USER_NAV = [
  {
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/dashboard/campaigns', label: 'Available Campaigns', icon: Sparkles },
      { to: '/dashboard/entries', label: 'My Entries', icon: ClipboardList },
      { to: '/dashboard/draw-history', label: 'Draw History', icon: History },
      { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/dashboard/profile', label: 'My Profile', icon: User },
      { to: '/dashboard/settings', label: 'Account Settings', icon: Settings },
    ],
  },
]

const ADMIN_NAV = [
  { items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Management',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/categories', label: 'Categories', icon: Layers },
      { to: '/admin/campaigns', label: 'Campaigns', icon: Gift },
      { to: '/admin/entries', label: 'Entries', icon: ClipboardList },
    ],
  },
  {
    title: 'Draws',
    items: [
      { to: '/admin/draws', label: 'Draw Management', icon: Shuffle },
      { to: '/admin/winners', label: 'Winners', icon: Trophy },
    ],
  },
  {
    title: 'Communication',
    items: [
      { to: '/admin/notifications', label: 'Announcements', icon: Megaphone },
      { to: '/admin/messages', label: 'Contact Inbox', icon: Inbox },
    ],
  },
  {
    title: 'Governance',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
      { to: '/admin/logs', label: 'Activity Logs', icon: ScrollText },
      { to: '/admin/settings', label: 'System Settings', icon: Settings },
    ],
  },
]

const AdminBadge = (
  <div className="flex items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gold-400">
    <FileText className="h-3.5 w-3.5" /> Administration
  </div>
)

export default function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:slug" element={<CampaignDetails />} />
          <Route path="about" element={<About />} />
          <Route path="winners" element={<Winners />} />
          <Route path="winners/:drawId" element={<DrawAudit />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="faqs" element={<FAQs />} />
          <Route path="contact" element={<Contact />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route element={<GuestRoute />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
          </Route>
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="auth/callback" element={<AuthCallback />} />
        </Route>

        <Route element={<UserRoute />}>
          <Route path="dashboard" element={<DashboardLayout sections={USER_NAV} variant="user" />}>
            <Route index element={<UserOverview />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="campaigns" element={<UserCampaigns />} />
            <Route path="entries" element={<UserEntries />} />
            <Route path="draw-history" element={<UserDrawHistory />} />
            <Route path="notifications" element={<UserNotifications />} />
            <Route path="settings" element={<UserSettings />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['admin', 'super_admin']} />}>
          <Route path="admin" element={<DashboardLayout sections={ADMIN_NAV} variant="admin" badge={AdminBadge} />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="entries" element={<AdminEntries />} />
            <Route path="draws" element={<AdminDraws />} />
            <Route path="winners" element={<AdminWinners />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
