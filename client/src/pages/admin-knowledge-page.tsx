import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { KnowledgeBase, Party, insertKnowledgeBaseSchema } from "@shared/schema";
import { z } from "zod";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

// Use the insertKnowledgeBaseSchema from the shared schema and extend it
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
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<KnowledgeBaseFormValues>;
    }) => {
      const res = await apiRequest("PATCH", `/api/knowledge/${id}`, data);
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
      updateMutation.mutate({
        id: editingEntry.id,
        data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  // Handle opening the dialog for creating/editing
  const handleOpenDialog = (entry?: KnowledgeBase) => {
    if (entry) {
      setEditingEntry(entry);
      resetForm(entry);
    } else {
      setEditingEntry(null);
      resetForm();
    }
    setIsDialogOpen(true);
  };

  // Handle toggling active status
  const handleToggleActive = (entry: KnowledgeBase) => {
    updateMutation.mutate({
      id: entry.id,
      data: { isActive: !entry.isActive },
    });
  };

  // Find party name by ID
  const getPartyName = (partyId: number) => {
    const party = parties.find((p) => p.id === partyId);
    return party ? party.name : "Unknown";
  };

  // Get party color
  const getPartyColor = (partyId: number) => {
    const party = parties.find((p) => p.id === partyId);
    return party ? party.color : "#000000";
  };

  return (
    <div className="container mx-auto p-6">
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
                    <div>
                      <p className="font-medium">{entry.title}</p>
                      <p className="text-sm text-neutral-500 truncate max-w-[400px]">
                        {entry.content.length > 100
                          ? `${entry.content.substring(0, 100)}...`
                          : entry.content}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Switch 
                        checked={entry.isActive} 
                        onCheckedChange={() => handleToggleActive(entry)}
                      />
                      <span className={entry.isActive ? "text-green-600 text-sm" : "text-neutral-400 text-sm"}>
                        {entry.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(entry)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        className="text-red-600 hover:bg-red-50 border-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Knowledge Base Entry" : "Add Knowledge Base Entry"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update the information in this knowledge base entry."
                : "Add new information to the party knowledge base."}
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
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value))}
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
                      The political party this knowledge relates to
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
                      <Input placeholder="Housing Policy Position" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive title for this knowledge entry
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
                        placeholder="Detailed policy information..."
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The main content that will be used by the AI to provide accurate information
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
                    <FormLabel>Source (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Party manifesto 2020, page 15"
                        {...field}
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
                        checked={field.value}
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
  );
}