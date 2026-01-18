import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from './translations';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  User,
  Users,
  Calendar,
  DollarSign,
  Building2,
  Bell,
  LogOut,
  Shield,
  UserCheck,
  PlusCircle,
  Settings,
} from 'lucide-react';

// Horse icon component since lucide doesn't have one
const HorseIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 8.5c0-.83-.67-1.5-1.5-1.5H17l-2-3h-4l1 3H8L6 4H4L3 7H1.5C.67 7 0 7.67 0 8.5S.67 10 1.5 10H3l1 3-2 7h3l2-5 3 5h3l-2-7 1-3h6.5c.83 0 1.5-.67 1.5-1.5z"/>
  </svg>
);

export default function AppSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const t = useTranslation();
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive = (path) => location.pathname === path;

  // Close sidebar on mobile when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Check if user has a stable they manage
  const hasStable = user?.roles?.includes('stable_manager');

  const mainNavItems = [
    {
      title: t.nav.dashboard,
      url: '/Dashboard',
      icon: LayoutDashboard,
    },
    {
      title: t.nav.riderProfile,
      url: '/RiderProfile',
      icon: User,
    },
    {
      title: t.nav.myHorses,
      url: '/MyHorses',
      icon: HorseIcon,
    },
    {
      title: t.quickActions?.guardianDashboard || 'Guardian',
      url: '/Guardian',
      icon: UserCheck,
      roles: ['guardian'],
    },
  ];

  const trainerNavItems = [
    {
      title: t.nav.myRiders,
      url: '/MyRiders',
      icon: Users,
    },
    {
      title: t.nav.schedule,
      url: '/Schedule',
      icon: Calendar,
    },
    {
      title: t.nav.billing,
      url: '/Billing',
      icon: DollarSign,
    },
  ];

  const stableNavItems = [
    {
      title: t.nav.stables,
      url: '/Stables',
      icon: Building2,
    },
    {
      title: t.quickActions?.manageStable || 'Manage Stable',
      url: '/ManageStable',
      icon: Settings,
      roles: ['stable_manager'],
    },
    {
      title: t.quickActions?.registerStable || 'Register Stable',
      url: '/RegisterStable',
      icon: PlusCircle,
    },
  ];

  const settingsNavItems = [
    {
      title: t.nav.notifications,
      url: '/NotificationSettings',
      icon: Bell,
    },
  ];

  const adminNavItems = [
    {
      title: 'Admin',
      url: '/Admin',
      icon: Shield,
    },
    {
      title: 'User Management',
      url: '/UserManagement',
      icon: Users,
    },
    {
      title: 'Admin Stables',
      url: '/AdminStables',
      icon: Building2,
    },
  ];

  const filterByRole = (items) => {
    return items.filter(item => {
      if (!item.roles) return true;
      const userRolesLower = user?.roles?.map(r => r.toLowerCase()) || [];
      return item.roles.some(role => userRolesLower.includes(role.toLowerCase()));
    });
  };

  const userRolesLower = user?.roles?.map(r => r.toLowerCase()) || [];
  const isTrainer = userRolesLower.includes('trainer');
  const isAdmin = userRolesLower.includes('admin');

  const handleLogout = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    logout('/');
  };

  const renderNavGroup = (items, label) => {
    const filteredItems = filterByRole(items);
    if (filteredItems.length === 0) return null;

    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[#1B4332]/60 text-xs uppercase tracking-wider">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filteredItems.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  className={isActive(item.url) ? 'bg-[#1B4332]/10 text-[#1B4332]' : 'text-[#1B4332]/70 hover:text-[#1B4332] hover:bg-[#1B4332]/5'}
                >
                  <Link to={item.url} onClick={handleNavClick}>
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className="border-r border-[#1B4332]/10">
      <SidebarHeader className="border-b border-[#1B4332]/10 p-4">
        <Link to="/Dashboard" onClick={handleNavClick} className="flex items-center gap-2">
          <img src="/logo.jpg" alt="RidersOS" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-semibold text-[#1B4332] text-lg">RidersOS</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {renderNavGroup(mainNavItems, 'Main')}
        {isTrainer && renderNavGroup(trainerNavItems, 'Trainer')}
        {renderNavGroup(stableNavItems, 'Stables')}
        {renderNavGroup(settingsNavItems, 'Settings')}
        {isAdmin && renderNavGroup(adminNavItems, 'Admin')}
      </SidebarContent>

      <SidebarFooter className="border-t border-[#1B4332]/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          {user?.profile_image ? (
            <img src={user.profile_image} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#1B4332]/10 flex items-center justify-center">
              <User className="w-4 h-4 text-[#1B4332]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1B4332] truncate">
              {user?.full_name || user?.email}
            </p>
            <p className="text-xs text-[#1B4332]/60 truncate">{user?.email}</p>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.nav.signOut}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
