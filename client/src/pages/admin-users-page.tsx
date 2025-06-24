import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import TopNavbar from "@/components/top-navbar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Edit, Trash2, Users, Eye, EyeOff } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Form schema for creating users
const userFormSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Query to fetch all users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<User[]>;
    },
  });

  // Form for creating/editing users
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      isAdmin: false,
    },
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: Omit<UserFormValues, "confirmPassword">) => {
      return apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  // Update user mutation (for admin status only)
  const updateMutation = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: number; isAdmin: boolean }) => {
      return apiRequest(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isAdmin }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: UserFormValues) => {
    const { confirmPassword, ...userData } = data;
    createMutation.mutate(userData);
  };

  // Reset form helper
  const resetForm = () => {
    form.reset({
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      isAdmin: false,
    });
    setEditingUser(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Handle opening the dialog for creating
  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Handle admin toggle
  const handleToggleAdmin = (user: User) => {
    updateMutation.mutate({ id: user.id, isAdmin: !user.isAdmin });
  };

  // Handle delete user
  const handleDeleteUser = (user: User) => {
    if (confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  // Filter out guest users for cleaner display
  const realUsers = users.filter(user => user.username !== "guest");

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavbar />
      
      <div className="container mx-auto p-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-neutral-500">
              Create and manage user accounts for the platform
            </p>
          </div>
          
          <Button onClick={handleOpenDialog} className="flex items-center">
            <PlusCircle className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>

        {/* User statistics cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realUsers.length}</div>
              <p className="text-xs text-muted-foreground">
                Active user accounts
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realUsers.filter(u => u.isAdmin).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Users with admin privileges
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Regular Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realUsers.filter(u => !u.isAdmin).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Standard user accounts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Manage user accounts and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-neutral-500">Loading users...</div>
              </div>
            ) : realUsers.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-neutral-500">No users found</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant={user.isAdmin ? "default" : "secondary"}>
                            {user.isAdmin ? "Admin" : "User"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleAdmin(user)}
                            disabled={updateMutation.isPending}
                          >
                            {user.isAdmin ? "Remove Admin" : "Make Admin"}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          disabled={deleteMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create user dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account. The user will receive their login credentials separately.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="johndoe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="john@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="Enter password" 
                              type={showPassword ? "text" : "password"} 
                              {...field} 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="Confirm password" 
                              type={showConfirmPassword ? "text" : "password"} 
                              {...field} 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="isAdmin"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Admin User
                        </FormLabel>
                        <FormDescription>
                          Grant administrative privileges to this user
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}