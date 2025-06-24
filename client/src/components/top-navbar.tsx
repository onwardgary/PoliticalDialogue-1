import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  MessageSquare, 
  TrendingUp, 
  BarChart, 
  UserCircle, 
  LogOut,
  Database,
  LogIn,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";

export default function TopNavbar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAdmin = user?.isAdmin || false;
  
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };
  
  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <header className="bg-white border-b border-neutral-200 w-full">
      {/* Desktop navbar */}
      <div className="hidden md:flex justify-between items-center px-6 py-3">
        <div className="flex items-center">
          <Link href="/">
            <div className="text-xl font-bold text-primary flex items-center mr-8">
              <MessageSquare className="mr-2 h-6 w-6" /> Suara.sg
            </div>
          </Link>
          
          <nav className="flex items-center space-x-4">
            <Link href="/">
              <div className={`flex items-center p-2 rounded-lg font-medium ${location === '/' ? 'text-primary' : 'text-neutral-600 hover:text-primary'}`}>
                <Home className="w-4 h-4 mr-2" />
                <span>Home</span>
              </div>
            </Link>

            {/* Admin options */}
            {isAdmin && (
              <>
                <Link href="/admin/knowledge">
                  <div className={`flex items-center p-2 rounded-lg font-medium ${location === '/admin/knowledge' ? 'text-primary' : 'text-neutral-600 hover:text-primary'}`}>
                    <Database className="w-4 h-4 mr-2" />
                    <span>Knowledge Base</span>
                  </div>
                </Link>
                <Link href="/admin/users">
                  <div className={`flex items-center p-2 rounded-lg font-medium ${location === '/admin/users' ? 'text-primary' : 'text-neutral-600 hover:text-primary'}`}>
                    <Users className="w-4 h-4 mr-2" />
                    <span>Users</span>
                  </div>
                </Link>
              </>
            )}
          </nav>
        </div>
        
        <div>
          {/* Login/logout buttons temporarily hidden - same as sidebar */}
        </div>
      </div>
      
      {/* Mobile navbar */}
      <div className="md:hidden flex justify-between items-center p-4">
        <Link href="/">
          <div className="text-xl font-bold text-primary flex items-center">
            <span className="mr-2 text-primary">🇸🇬</span> Suara.sg
          </div>
        </Link>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="p-2 rounded-full hover:bg-neutral-100">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <MobileSidebar />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function MobileSidebar() {
  const [location, setLocation] = useLocation();
  
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAdmin = user?.isAdmin || false;
  
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };
  
  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <div className="flex flex-col h-full py-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary flex items-center">
          <span className="mr-2 text-primary">🇸🇬</span> Suara.sg
        </h2>
        {user ? (
          <div className="flex items-center mt-4">
            <Avatar className="h-8 w-8 mr-2">
              <AvatarFallback className="bg-primary text-white">
                {user.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 mt-1">A Place for Civic Engagement</p>
        )}
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-2">
          <li>
            <Link href="/">
              <div className={`flex items-center p-3 rounded-lg font-medium ${location === '/' ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <Home className="w-5 h-5 mr-3" />
                <span>Home</span>
              </div>
            </Link>
          </li>
          
          {/* Admin menu - only visible to admins */}
          {isAdmin && (
            <li>
              <Link href="/admin/knowledge">
                <div className={`flex items-center p-3 rounded-lg font-medium ${location === '/admin/knowledge' ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                  <Database className="w-5 h-5 mr-3" />
                  <span>Knowledge Base</span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/admin/users">
                <div className={`flex items-center p-3 rounded-lg font-medium ${location === '/admin/users' ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                  <Users className="w-5 h-5 mr-3" />
                  <span>User Management</span>
                </div>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      
      <div className="mt-4 pt-4 border-t border-neutral-200">
        {/* Login/logout buttons temporarily hidden - same as sidebar */}
      </div>
    </div>
  );
}