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
  // Set isAdmin to true for development access to knowledge base
  const isAdmin = true;
  
  const [location] = useLocation();

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
            <Link href="/trending">
              <a className={`flex items-center p-2 rounded-lg font-medium ${location.startsWith('/trending') ? 'text-primary bg-blue-50' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                <TrendingUp className="w-5 h-5 mr-3" />
                <span>Trending Debates</span>
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
          {isAdmin && (
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
        <div className="flex items-center justify-center">
          <p className="text-sm text-neutral-500">Powered by OpenAI's GPT-4o</p>
        </div>
      </div>
    </aside>
  );
}
