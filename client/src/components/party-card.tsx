import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Info, ArrowRight } from "lucide-react";

export type Party = {
  id: number;
  name: string;
  shortName: string;
  color: string;
  description: string;
};

export default function PartyCard({ party }: { party: Party }) {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [topic, setTopic] = useState("");
  
  const startDebateMutation = useMutation({
    mutationFn: async (data: { partyId: number, topic?: string }) => {
      const res = await apiRequest("POST", "/api/debates", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Debate started",
        description: `You are now debating with ${party.name}.`,
      });
      setIsDialogOpen(false);
      setTopic("");
      // Use the secure ID for navigation if available
      setLocation(data.secureId ? `/debate/s/${data.secureId}` : `/debate/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Could not start debate: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const startDebate = () => {
    if (topic.trim()) {
      startDebateMutation.mutate({ partyId: party.id, topic: topic.trim() });
    } else {
      startDebateMutation.mutate({ partyId: party.id });
    }
  };
  
  const handleCardClick = () => {
    setIsDialogOpen(true);
  };
  
  const getBgColor = () => {
    return `bg-[${party.color}]/10`;
  };
  
  const getTextColor = () => {
    return `text-[${party.color}]`;
  };

  const getPartyColor = () => {
    switch (party.shortName) {
      case "PAP":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "WP":
        return "bg-blue-50 text-blue-800 border-blue-300";
      case "PSP":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-300";
    }
  };
  
  return (
    <>
      <Card 
        className="hover:shadow-md transition duration-300 hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/20"
        onClick={handleCardClick}
      >
        <CardContent className="p-5 pt-6">
          <div className="flex items-center mb-3">
            <div className={`w-12 h-12 ${getPartyColor()} rounded-full flex items-center justify-center mr-3 border shadow-sm`}>
              <span className="font-bold">{party.shortName}</span>
            </div>
            <h3 className="text-lg font-semibold">{party.name}</h3>
          </div>
          <p className="text-neutral-600 text-sm mb-2">{party.description}</p>
        </CardContent>
        <CardFooter className="px-5 pb-5 pt-0">
          <Button 
            className="mt-2 w-full gap-2 group"
            variant="outline"
          >
            <MessageSquare className="h-4 w-4 group-hover:text-primary transition" />
            <span>Debate</span>
            <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-8 h-8 ${getPartyColor()} rounded-full flex items-center justify-center`}>
                <span className="font-bold text-sm">{party.shortName}</span>
              </div>
              Start a debate with {party.name}
            </DialogTitle>
            <DialogDescription>
              Enter a policy topic to discuss with the {party.shortName} bot or leave blank for a general conversation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="topic" className="flex items-center gap-1">
                <Info className="h-4 w-4 text-muted-foreground" />
                Topic (optional)
              </Label>
              <Input
                id="topic"
                placeholder="e.g. Housing affordability, education policy, healthcare"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="col-span-3"
              />
              <p className="text-sm text-muted-foreground">
                Providing a specific topic helps the AI respond with relevant policies.
              </p>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={startDebate}
              disabled={startDebateMutation.isPending}
              className="gap-2"
            >
              {startDebateMutation.isPending ? "Starting..." : "Start Debate"} 
              <MessageSquare className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
