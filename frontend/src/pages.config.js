import Admin from './pages/Admin';
import AdminStables from './pages/AdminStables';
import Billing from './pages/Billing';
import ContactUs from './pages/ContactUs';
import Dashboard from './pages/Dashboard';
import Guardian from './pages/Guardian';
import Home from './pages/Home';
import ManageStable from './pages/ManageStable';
import MyHorses from './pages/MyHorses';
import MyRiders from './pages/MyRiders';
import NotificationSettings from './pages/NotificationSettings';
import RegisterStable from './pages/RegisterStable';
import RiderProfile from './pages/RiderProfile';
import Schedule from './pages/Schedule';
import StableDetails from './pages/StableDetails';
import Stables from './pages/Stables';
import UserManagement from './pages/UserManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "AdminStables": AdminStables,
    "Billing": Billing,
    "ContactUs": ContactUs,
    "Dashboard": Dashboard,
    "Guardian": Guardian,
    "Home": Home,
    "ManageStable": ManageStable,
    "MyHorses": MyHorses,
    "MyRiders": MyRiders,
    "NotificationSettings": NotificationSettings,
    "RegisterStable": RegisterStable,
    "RiderProfile": RiderProfile,
    "Schedule": Schedule,
    "StableDetails": StableDetails,
    "Stables": Stables,
    "UserManagement": UserManagement,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};