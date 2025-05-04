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
  LogIn
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";

export default function Sidebar() {
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
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-neutral-200 h-screen">
      <div className="p-4 border-b border-neutral-200">
        <h1 className="text-2xl font-bold text-primary flex items-center">
          <MessageSquare className="mr-2 h-6 w-6" /> Suara.sg
        </h1>
        <p className="text-sm text-neutral-500 mt-1">Political Debate Platform</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <Link href="/">
              <div className={`flex items-center p-2 rounded-lg font-medium ${location === '/' ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <Home className="w-5 h-5 mr-3" />
                <span>Home</span>
              </div>
            </Link>
          </li>
          {/* Trending page temporarily hidden
          <li>
            <Link href="/trending">
              <div className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/trending') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <TrendingUp className="w-5 h-5 mr-3" />
                <span>Trending</span>
              </div>
            </Link>
          </li>
          */}
          
          {/* Statistics menu item hidden per user request 
          <li>
            <Link href="/statistics">
              <div className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/statistics') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <BarChart className="w-5 h-5 mr-3" />
                <span>Statistics</span>
              </div>
            </Link>
          </li>
          */}
          
          {/* User specific menu items - temporarily hidden 
          {user && (
            <>
              <li>
                <Link href="/profile">
                  <div className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/profile') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                    <UserCircle className="w-5 h-5 mr-3" />
                    <span>My Profile</span>
                  </div>
                </Link>
              </li>
              
              <Separator className="my-4" />
            </>
          )}
          */}
          
          {/* Admin menu items */}
          {isAdmin && (
            <li>
              <Link href="/admin/knowledge">
                <div className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/admin') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                  <Database className="w-5 h-5 mr-3" />
                  <span>Knowledge Base</span>
                </div>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-neutral-200">
        {/* User info and login/register temporarily hidden
        {user ? (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center p-2">
              <Avatar className="h-8 w-8 mr-2">
                <AvatarFallback className="bg-primary text-white">
                  {user.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoggingOut ? "Logging out..." : "Logout"}
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full flex items-center justify-center"
            onClick={handleLogin}
          >
            <LogIn className="mr-2 h-4 w-4" />
            Login / Register
          </Button>
        )}
        */}
        
        {/* Removed "Powered by" text as requested */}
      </div>
    </aside>
  );
}