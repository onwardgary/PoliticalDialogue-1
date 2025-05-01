import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { MessageSquare, ArrowRight, Clock3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  const [selectedRounds, setSelectedRounds] = useState<string>("6"); // Default to 6 rounds
  
  const startConversationMutation = useMutation({
    mutationFn: async (data: { 
      partyId: number, 
      topic?: string,
      maxRounds?: number
    }) => {
      const res = await apiRequest("POST", "/api/debates", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Debate started",
        description: `You are now debating with the ${party.name} Unofficial Fanbot.`,
      });
      // Use the secure ID for navigation if available
      setLocation(data.secureId ? `/debate/s/${data.secureId}` : `/debate/${data.id}`);
      setIsDialogOpen(false);
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
      topic: "Policy debate with citizen",
      maxRounds: parseInt(selectedRounds)
    });
  };
  
  const handleCardClick = () => {
    setIsDialogOpen(true);
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
            <div>
              <h3 className="text-lg font-semibold">{party.name}</h3>
              <div className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded inline-block mt-1">Unofficial Fanbot</div>
            </div>
          </div>
          <p className="text-neutral-600 text-sm mb-2">{party.description}</p>
        </CardContent>
        <CardFooter className="px-5 pb-5 pt-0">
          <Button 
            className="mt-2 w-full gap-2 group"
            variant="outline"
          >
            <MessageSquare className="h-4 w-4 group-hover:text-primary transition" />
            <span>Debate with {party.shortName} Fanbot</span>
            <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Debate Length</DialogTitle>
            <DialogDescription>
              Choose how many rounds you'd like to debate with the {party.name} <strong>Unofficial Fanbot</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rounds" className="text-right">
                Rounds
              </Label>
              <Select 
                value={selectedRounds} 
                onValueChange={setSelectedRounds}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select number of rounds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">
                    <div className="flex items-center">
                      <Clock3 className="h-4 w-4 mr-2" />
                      <span>3 Rounds (Quick)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="6">
                    <div className="flex items-center">
                      <Clock3 className="h-4 w-4 mr-2" />
                      <span>6 Rounds (Standard)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="8">
                    <div className="flex items-center">
                      <Clock3 className="h-4 w-4 mr-2" />
                      <span>8 Rounds (Extended)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-start">
            <Button
              onClick={startDebate}
              disabled={startConversationMutation.isPending}
              className="w-full sm:w-auto"
            >
              {startConversationMutation.isPending ? (
                <span>Starting debate...</span>
              ) : (
                <span>Start Debate</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
