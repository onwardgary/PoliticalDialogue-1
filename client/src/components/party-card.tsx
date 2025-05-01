import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { MessageSquare, ArrowRight } from "lucide-react";

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
  
  const startConversationMutation = useMutation({
    mutationFn: async (data: { 
      partyId: number, 
      topic?: string
      // Removed mode parameter as we always use debate mode now
    }) => {
      const res = await apiRequest("POST", "/api/debates", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Debate started",
        description: `You are now debating with ${party.name}.`,
      });
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
    startConversationMutation.mutate({ 
      partyId: party.id, 
      topic: "Policy debate with citizen"
      // Removed mode parameter as it's no longer needed
    });
  };
  
  const handleCardClick = () => {
    startDebate();
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
          disabled={startConversationMutation.isPending}
        >
          <MessageSquare className="h-4 w-4 group-hover:text-primary transition" />
          {startConversationMutation.isPending ? (
            <span>Starting debate...</span>
          ) : (
            <span>Debate with {party.shortName}</span>
          )}
          <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition" />
        </Button>
      </CardFooter>
    </Card>
  );
}
