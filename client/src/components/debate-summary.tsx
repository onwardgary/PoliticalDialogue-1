import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DebateSummary as DebateSummaryType } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DebateSummaryProps = {
  debateId: number;
  summary: DebateSummaryType;
  partyName: string;
  partyShortName: string;
};

export default function DebateSummary({ 
  debateId, 
  summary, 
  partyName,
  partyShortName
}: DebateSummaryProps) {
  const { toast } = useToast();
  
  const voteMutation = useMutation({
    mutationFn: async (vote: { votedFor: "party" | "citizen" }) => {
      const res = await apiRequest("POST", `/api/debates/${debateId}/vote`, vote);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Vote recorded",
        description: "Thank you for your vote!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Could not record vote: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleVote = (votedFor: "party" | "citizen") => {
    voteMutation.mutate({ votedFor });
  };
  
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Your Debate Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-primary mb-3 flex items-center">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center mr-2">
                <span className="text-white font-bold text-xs">P</span>
              </div>
              {partyName} Arguments
            </h4>
            <ul className="space-y-3">
              {summary.partyArguments.map((argument, index) => (
                <li key={index} className="flex">
                  <div className="mr-2 text-primary">•</div>
                  <p className="text-sm text-neutral-700">{argument}</p>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-md font-medium text-secondary mb-3 flex items-center">
              <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center mr-2">
                <span className="text-white font-bold text-xs">C</span>
              </div>
              Your Arguments
            </h4>
            <ul className="space-y-3">
              {summary.citizenArguments.map((argument, index) => (
                <li key={index} className="flex">
                  <div className="mr-2 text-secondary">•</div>
                  <p className="text-sm text-neutral-700">{argument}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="mt-6 border-t border-neutral-200 pt-4">
          <h4 className="text-md font-medium mb-2">Who made stronger arguments?</h4>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => handleVote("party")}
              variant="outline"
              className="flex-1 p-3 hover:bg-blue-50 hover:border-primary"
              disabled={voteMutation.isPending}
            >
              <div className="flex items-center">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center mr-2">
                  <span className="text-white font-bold text-xs">P</span>
                </div>
                <span className="font-medium">{partyShortName} Bot</span>
              </div>
            </Button>
            <Button
              onClick={() => handleVote("citizen")}
              variant="outline"
              className="flex-1 p-3 hover:bg-orange-50 hover:border-secondary"
              disabled={voteMutation.isPending}
            >
              <div className="flex items-center">
                <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center mr-2">
                  <span className="text-white font-bold text-xs">C</span>
                </div>
                <span className="font-medium">Citizen (You)</span>
              </div>
            </Button>
          </div>
          <p className="text-xs text-neutral-500 mt-2 text-center">Your vote contributes to the aggregate public opinion</p>
        </div>
      </CardContent>
    </Card>
  );
}
