import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorText;
    try {
      errorText = await res.text();
    } catch (e) {
      errorText = res.statusText;
    }
    
    console.error(`API error: ${res.status} - ${errorText}`);
    throw new Error(`${res.status}: ${errorText}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Optimize for fast performance - only log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`API request: ${method} ${url}`, data ? 'with data' : 'without data');
  }
  
  const options: RequestInit = {
    method,
    headers: data ? { 
      "Content-Type": "application/json",
      // Add cache control header to prevent browser caching
      "Cache-Control": "no-cache"
    } : {
      "Cache-Control": "no-cache"
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    // Add priority hints for faster processing
    priority: "high"
  } as RequestInit; // Type cast needed because priority is not in standard type
  
  try {
    const res = await fetch(url, options);
    
    // Optimize for fast performance - only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`API response: ${method} ${url} status: ${res.status}`);
      
      // Inspect cookies that were set
      const setCookieHeader = res.headers.get('set-cookie');
      if (setCookieHeader) {
        console.log('Set-Cookie header received:', setCookieHeader);
      }
    }
    
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API request error for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    console.log(`Query function executing for ${url} with behavior on 401: ${unauthorizedBehavior}`);
    
    try {
      const res = await fetch(url, {
        credentials: "include",
      });
      
      console.log(`Query response for ${url}: status ${res.status}`);
      
      // Inspect cookies
      const cookies = document.cookie;
      console.log(`Current cookies at query time:`, cookies);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log(`Returning null for 401 at ${url} as per configuration`);
        return null;
      }
      
      // Check headers
      const contentType = res.headers.get('content-type');
      console.log(`Content-Type for ${url}: ${contentType}`);
      
      await throwIfResNotOk(res);
      const data = await res.json();
      console.log(`Query data for ${url}:`, data);
      return data;
    } catch (error) {
      console.error(`Query error for ${url}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
