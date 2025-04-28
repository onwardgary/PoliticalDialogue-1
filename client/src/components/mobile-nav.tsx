import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  MessageSquare, 
  TrendingUp,
  UserCircle,
  Menu,
  Database,
  LogIn,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export function MobileHeader() {
  return (
    <header className="md:hidden bg-white border-b border-neutral-200 p-4 flex items-center justify-between">
      <Link href="/">
        <div className="text-xl font-bold text-primary flex items-center">
          <MessageSquare className="mr-2 h-5 w-5" /> Suara.sg
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
          <MessageSquare className="mr-2 h-5 w-5" /> Suara.sg
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
          <p className="text-sm text-neutral-500 mt-1">Political Debate Platform</p>
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
          <li>
            <Link href="/trending">
              <div className={`flex items-center p-3 rounded-lg font-medium ${location.startsWith('/trending') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <TrendingUp className="w-5 h-5 mr-3" />
                <span>Trending</span>
              </div>
            </Link>
          </li>
          
          {/* User specific menu items */}
          {user && (
            <>
              <li>
                <Link href="/profile">
                  <div className={`flex items-center p-3 rounded-lg font-medium ${location.startsWith('/profile') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                    <UserCircle className="w-5 h-5 mr-3" />
                    <span>My Profile</span>
                  </div>
                </Link>
              </li>
              
              <Separator className="my-4" />
            </>
          )}
          
          {/* Admin menu items */}
          {isAdmin && (
            <li>
              <Link href="/admin/knowledge">
                <div className={`flex items-center p-3 rounded-lg font-medium ${location.startsWith('/admin') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                  <Database className="w-5 h-5 mr-3" />
                  <span>Knowledge Base</span>
                </div>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      
      <div className="mt-4 pt-4 border-t border-neutral-200">
        {user ? (
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="w-full flex items-center justify-center"
            disabled={isLoggingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        ) : (
          <Button 
            onClick={handleLogin} 
            variant="outline" 
            className="w-full flex items-center justify-center"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Login / Register
          </Button>
        )}
      </div>
    </div>
  );
}

export function MobileNavigation() {
  const [location] = useLocation();
  
  // We no longer need to use try/catch since useAuth will always return a valid context
  const { user } = useAuth();
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex justify-around p-2 z-10">
      <Link href="/">
        <div className={`flex flex-col items-center p-2 ${location === '/' ? 'text-primary' : 'text-neutral-500'}`}>
          <Home className="h-5 w-5" />
          <span className="text-xs mt-1">Home</span>
        </div>
      </Link>
      <Link href="/debate">
        <div className={`flex flex-col items-center p-2 ${location.startsWith('/debate') ? 'text-primary' : 'text-neutral-500'}`}>
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs mt-1">Debates</span>
        </div>
      </Link>
      <Link href="/trending">
        <div className={`flex flex-col items-center p-2 ${location.startsWith('/trending') ? 'text-primary' : 'text-neutral-500'}`}>
          <TrendingUp className="h-5 w-5" />
          <span className="text-xs mt-1">Trending</span>
        </div>
      </Link>
      <Link href={user ? "/profile" : "/auth"}>
        <div className={`flex flex-col items-center p-2 ${location.startsWith('/profile') || location.startsWith('/auth') ? 'text-primary' : 'text-neutral-500'}`}>
          <UserCircle className="h-5 w-5" />
          <span className="text-xs mt-1">{user ? "Profile" : "Login"}</span>
        </div>
      </Link>
    </nav>
  );
}
