import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MessageSquare, HelpCircle, ArrowRight } from "lucide-react";

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
  
  const startConversationMutation = useMutation({
    mutationFn: async (data: { 
      partyId: number, 
      topic?: string,
      mode: "debate" | "discuss" 
    }) => {
      const res = await apiRequest("POST", "/api/debates", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conversation started",
        description: `You are now talking with ${party.name}.`,
      });
      setIsDialogOpen(false);
      // Use the secure ID for navigation if available
      setLocation(data.secureId ? `/debate/s/${data.secureId}` : `/debate/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Could not start conversation: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const startDebate = () => {
    startConversationMutation.mutate({ 
      partyId: party.id, 
      topic: "Policy debate with citizen",
      mode: "debate"
    });
  };
  
  const startDiscussion = () => {
    startConversationMutation.mutate({ 
      partyId: party.id,
      topic: "Policy discussion with recommendations",
      mode: "discuss"
    });
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
            <span>Talk to {party.shortName}</span>
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
              Choose your conversation with {party.name}
            </DialogTitle>
            <DialogDescription>
              Select how you'd like to engage with the {party.shortName} representative.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <Button 
              onClick={startDebate}
              disabled={startConversationMutation.isPending}
              className="h-auto py-6 flex flex-col items-center gap-3"
              variant="outline"
            >
              <MessageSquare className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold mb-1">Debate</div>
                <p className="text-sm text-muted-foreground">
                  Challenge the party on policy positions and get a point-by-point evaluation.
                </p>
              </div>
            </Button>
            
            <Button 
              onClick={startDiscussion}
              disabled={startConversationMutation.isPending}
              className="h-auto py-6 flex flex-col items-center gap-3"
              variant="outline"
            >
              <HelpCircle className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold mb-1">Discuss & Learn</div>
                <p className="text-sm text-muted-foreground">
                  Get policy explanations and personalized recommendations on what to learn more about.
                </p>
              </div>
            </Button>
          </div>
          
          <DialogFooter className="sm:justify-start gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            {startConversationMutation.isPending && (
              <p className="text-sm text-muted-foreground">Starting conversation...</p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
