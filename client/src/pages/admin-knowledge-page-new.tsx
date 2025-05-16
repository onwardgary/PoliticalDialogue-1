import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { KnowledgeBase, Party, insertKnowledgeBaseSchema } from "@shared/schema";
import { z } from "zod";
import TopNavbar from "@/components/top-navbar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Edit, Trash2, X, Check, Database } from "lucide-react";

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
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Use the insertKnowledgeBaseSchema from the shared schema
const knowledgeBaseFormSchema = insertKnowledgeBaseSchema.extend({});

type KnowledgeBaseFormValues = z.infer<typeof knowledgeBaseFormSchema>;

export default function AdminKnowledgePage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeBase | null>(null);

  // Query to fetch all knowledge base entries
  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ["/api/knowledge"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error("Failed to fetch knowledge base entries");
      return res.json() as Promise<KnowledgeBase[]>;
    },
  });

  // Query to fetch all parties
  const { data: parties = [], isLoading: isLoadingParties } = useQuery({
    queryKey: ["/api/parties"],
    queryFn: async () => {
      const res = await fetch("/api/parties");
      if (!res.ok) throw new Error("Failed to fetch parties");
      return res.json() as Promise<Party[]>;
    },
  });

  // Form for creating/editing knowledge base entries
  const form = useForm<KnowledgeBaseFormValues>({
    resolver: zodResolver(knowledgeBaseFormSchema),
    defaultValues: {
      partyId: undefined,
      title: "",
      content: "",
      source: "",
      isActive: true,
    },
  });

  // Reset form when edit state changes
  const resetForm = (entry?: KnowledgeBase) => {
    if (entry) {
      form.reset({
        partyId: entry.partyId,
        title: entry.title,
        content: entry.content,
        source: entry.source || "",
        isActive: entry.isActive,
      });
    } else {
      form.reset({
        partyId: undefined,
        title: "",
        content: "",
        source: "",
        isActive: true,
      });
    }
  };

  // Mutation for creating new entries
  const createMutation = useMutation({
    mutationFn: async (data: KnowledgeBaseFormValues) => {
      const res = await apiRequest("POST", "/api/knowledge", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Knowledge base entry created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating entries
  const updateMutation = useMutation({
    mutationFn: async (data: KnowledgeBaseFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PATCH", `/api/knowledge/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      setIsDialogOpen(false);
      setEditingEntry(null);
      toast({
        title: "Success",
        description: "Knowledge base entry updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting entries
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/knowledge/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({
        title: "Success",
        description: "Knowledge base entry deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: KnowledgeBaseFormValues) => {
    if (editingEntry) {
      updateMutation.mutate({ ...data, id: editingEntry.id });
    } else {
      createMutation.mutate(data);
    }
  };

  // Handle opening the dialog for editing or creating
  const handleOpenDialog = (entry?: KnowledgeBase) => {
    setEditingEntry(entry || null);
    resetForm(entry);
    setIsDialogOpen(true);
  };

  // Get party name by ID
  const getPartyName = (partyId: number) => {
    const party = parties.find((p) => p.id === partyId);
    return party ? party.name : "Unknown";
  };

  // Get party color by ID
  const getPartyColor = (partyId: number) => {
    const party = parties.find((p) => p.id === partyId);
    return party ? party.color : "#000000";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavbar />
      
      <div className="container mx-auto p-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Knowledge Base Management</h1>
            <p className="text-neutral-500">
              Manage party policy information and background knowledge for the AI
            </p>
          </div>
          
          <Button onClick={() => handleOpenDialog()} className="flex items-center">
            <PlusCircle className="w-4 h-4 mr-2" />
            Add New Entry
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              RAG Implementation
            </CardTitle>
            <CardDescription>
              Add curated policy material to improve the PartyBot's knowledge base. This information will be used to
              augment the AI's responses with accurate details about each party's policy positions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600">
              The Retrieval-Augmented Generation (RAG) system will use this content as context when generating responses.
              For best results:
            </p>
            <ul className="list-disc ml-6 mt-2 text-sm text-neutral-600 space-y-1">
              <li>Add specific policy positions and manifesto points</li>
              <li>Include factual information about party stances on key issues</li>
              <li>Cite official sources where possible</li>
              <li>Keep entries concise and focused on a single topic</li>
            </ul>
          </CardContent>
        </Card>

        {isLoadingEntries || isLoadingParties ? (
          <div className="text-center p-8">Loading knowledge base entries...</div>
        ) : entries.length === 0 ? (
          <div className="text-center p-8 bg-neutral-50 rounded-lg border border-neutral-200">
            <Database className="h-10 w-10 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-1">No Knowledge Base Entries</h3>
            <p className="text-neutral-500 mb-4">
              Add information to improve the PartyBot's responses with accurate policy details.
            </p>
            <Button onClick={() => handleOpenDialog()}>Add First Entry</Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Party</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[120px] text-center">Status</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge
                        style={{ backgroundColor: getPartyColor(entry.partyId) }}
                        className="text-white"
                      >
                        {getPartyName(entry.partyId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{entry.title}</div>
                      <div className="text-sm text-neutral-500 truncate max-w-sm">
                        {entry.content.length > 100
                          ? `${entry.content.substring(0, 100)}...`
                          : entry.content}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.isActive ? (
                        <Badge variant="default" className="bg-green-500">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Are you sure you want to delete this entry?"
                              )
                            ) {
                              deleteMutation.mutate(entry.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? "Edit Knowledge Base Entry" : "Add Knowledge Base Entry"}
              </DialogTitle>
              <DialogDescription>
                Add information that will be retrieved when the AI answers questions about
                this party's policies.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="partyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Party</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        defaultValue={field.value?.toString()}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a party" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parties.map((party) => (
                            <SelectItem key={party.id} value={party.id.toString()}>
                              {party.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Which party's knowledge base this entry belongs to
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Housing Policy" {...field} />
                      </FormControl>
                      <FormDescription>
                        Clear, concise title for this piece of information
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="We plan to build 100,000 affordable homes..."
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Details about this policy position or factual information
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Party manifesto 2025"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Where this information comes from (for reference)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? true}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Only active entries will be used by the AI
                        </FormDescription>
                      </div>
                      <FormMessage />
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
                  <Button type="submit">
                    {editingEntry ? "Update Entry" : "Add Entry"}
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