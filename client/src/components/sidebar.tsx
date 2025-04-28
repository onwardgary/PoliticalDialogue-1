import { Link, useLocation } from "wouter";
import { 
  Home, 
  MessageSquare, 
  TrendingUp, 
  BarChart, 
  UserCircle, 
  LogOut,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Sidebar() {
  // Temporary mock user for development
  const mockUser = {
    username: "Test User",
    email: "test@example.com",
    isAdmin: true, // Set to true for admin view, false for regular users
  };
  
  const [location] = useLocation();

  const handleLogout = () => {
    console.log("Logout clicked");
    // Mock logout for now
  };

  const getFirstLetters = (name: string) => {
    return name.split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-neutral-200 h-screen fixed left-0 top-0">
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
              <a className={`flex items-center p-2 rounded-lg font-medium ${location === '/' ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <Home className="w-5 h-5 mr-3" />
                <span>Home</span>
              </a>
            </Link>
          </li>
          <li>
            <Link href="/debates">
              <a className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/debates') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <MessageSquare className="w-5 h-5 mr-3" />
                <span>My Debates</span>
              </a>
            </Link>
          </li>
          <li>
            <Link href="/trending">
              <a className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/trending') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <TrendingUp className="w-5 h-5 mr-3" />
                <span>Trending</span>
              </a>
            </Link>
          </li>
          <li>
            <Link href="/statistics">
              <a className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/statistics') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <BarChart className="w-5 h-5 mr-3" />
                <span>Statistics</span>
              </a>
            </Link>
          </li>
          <li>
            <Link href="/profile">
              <a className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/profile') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <UserCircle className="w-5 h-5 mr-3" />
                <span>Profile</span>
              </a>
            </Link>
          </li>
          {mockUser.isAdmin && (
            <li>
              <Link href="/admin/knowledge">
                <a className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/admin') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                  <Database className="w-5 h-5 mr-3" />
                  <span>Knowledge Base</span>
                </a>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-neutral-200">
        <div className="flex items-center">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-white">
              {getFirstLetters(mockUser.username)}
            </AvatarFallback>
          </Avatar>
          <div className="ml-3">
            <p className="font-medium text-sm">{mockUser.username}</p>
            <p className="text-xs text-neutral-500">{mockUser.email}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout} 
            className="ml-auto text-neutral-400 hover:text-neutral-600"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
