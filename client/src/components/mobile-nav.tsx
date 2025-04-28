import { Link, useLocation } from "wouter";
import { 
  Home, 
  MessageSquare, 
  TrendingUp,
  UserCircle,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

export function MobileHeader() {
  return (
    <header className="md:hidden bg-white border-b border-neutral-200 p-4 flex items-center justify-between">
      <Link href="/">
        <a className="text-xl font-bold text-primary flex items-center">
          <MessageSquare className="mr-2 h-5 w-5" /> Suara.sg
        </a>
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
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="flex flex-col h-full py-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary flex items-center">
          <MessageSquare className="mr-2 h-5 w-5" /> Suara.sg
        </h2>
        <p className="text-sm text-neutral-500">Welcome, {user?.username}</p>
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-2">
          <li>
            <Link href="/">
              <a className={`flex items-center p-3 rounded-lg font-medium ${location === '/' ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <Home className="w-5 h-5 mr-3" />
                <span>Home</span>
              </a>
            </Link>
          </li>
          <li>
            <Link href="/debates">
              <a className={`flex items-center p-3 rounded-lg font-medium ${location.startsWith('/debates') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <MessageSquare className="w-5 h-5 mr-3" />
                <span>My Debates</span>
              </a>
            </Link>
          </li>
          <li>
            <Link href="/trending">
              <a className={`flex items-center p-3 rounded-lg font-medium ${location.startsWith('/trending') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <TrendingUp className="w-5 h-5 mr-3" />
                <span>Trending</span>
              </a>
            </Link>
          </li>
          <li>
            <Link href="/profile">
              <a className={`flex items-center p-3 rounded-lg font-medium ${location.startsWith('/profile') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <UserCircle className="w-5 h-5 mr-3" />
                <span>Profile</span>
              </a>
            </Link>
          </li>
        </ul>
      </nav>
      
      <div className="mt-4 pt-4 border-t border-neutral-200">
        <Button 
          onClick={handleLogout} 
          variant="outline" 
          className="w-full"
        >
          <span>Logout</span>
        </Button>
      </div>
    </div>
  );
}

export function MobileNavigation() {
  const [location] = useLocation();
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex justify-around p-2 z-10">
      <Link href="/">
        <a className={`flex flex-col items-center p-2 ${location === '/' ? 'text-primary' : 'text-neutral-500'}`}>
          <Home className="h-5 w-5" />
          <span className="text-xs mt-1">Home</span>
        </a>
      </Link>
      <Link href="/debates">
        <a className={`flex flex-col items-center p-2 ${location.startsWith('/debates') || location.startsWith('/debate/') ? 'text-primary' : 'text-neutral-500'}`}>
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs mt-1">Debates</span>
        </a>
      </Link>
      <Link href="/trending">
        <a className={`flex flex-col items-center p-2 ${location.startsWith('/trending') ? 'text-primary' : 'text-neutral-500'}`}>
          <TrendingUp className="h-5 w-5" />
          <span className="text-xs mt-1">Trending</span>
        </a>
      </Link>
      <Link href="/profile">
        <a className={`flex flex-col items-center p-2 ${location.startsWith('/profile') ? 'text-primary' : 'text-neutral-500'}`}>
          <UserCircle className="h-5 w-5" />
          <span className="text-xs mt-1">Profile</span>
        </a>
      </Link>
    </nav>
  );
}
