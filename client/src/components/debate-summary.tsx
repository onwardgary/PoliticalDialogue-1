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
        
        {/* Key Arguments Summary */}
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
        
        {/* Point-by-Point Comparison */}
        {summary.keyPoints && summary.keyPoints.length > 0 && (
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <h4 className="text-md font-semibold mb-4">Point-by-Point Analysis</h4>
            <div className="space-y-4">
              {summary.keyPoints.map((point, index) => (
                <div key={index} className="rounded-lg border border-neutral-200 overflow-hidden">
                  <div className="bg-neutral-50 p-3 border-b border-neutral-200">
                    <h5 className="font-medium text-neutral-800">{point.point}</h5>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200">
                    <div className="p-3">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center mr-2">
                          <span className="text-white font-bold text-xs">P</span>
                        </div>
                        <span className="text-sm font-medium text-primary">{partyShortName} Position</span>
                      </div>
                      <p className="text-sm text-neutral-700">{point.partyPosition}</p>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-secondary rounded-full flex items-center justify-center mr-2">
                          <span className="text-white font-bold text-xs">C</span>
                        </div>
                        <span className="text-sm font-medium text-secondary">Your Position</span>
                      </div>
                      <p className="text-sm text-neutral-700">{point.citizenPosition}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* AI Deliberation */}
        {summary.conclusion && (
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <h4 className="text-md font-semibold mb-2">AI Deliberation</h4>
            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
              <div className="flex items-center mb-2">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  summary.conclusion.outcome === 'party' 
                    ? 'bg-blue-100 text-blue-800' 
                    : summary.conclusion.outcome === 'citizen'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-800'
                }`}>
                  {summary.conclusion.outcome === 'party' 
                    ? `${partyShortName} arguments were stronger` 
                    : summary.conclusion.outcome === 'citizen'
                      ? 'Your arguments were stronger'
                      : 'The debate was balanced'}
                </span>
              </div>
              <p className="text-sm text-neutral-700">{summary.conclusion.reasoning}</p>
            </div>
          </div>
        )}
        
        {/* User Voting */}
        <div className="mt-6 border-t border-neutral-200 pt-4">
          <h4 className="text-md font-medium mb-2">Who do you think made stronger arguments?</h4>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button
              onClick={() => handleVote("party")}
              variant="outline"
              className="w-full sm:flex-1 p-3 hover:bg-blue-50 hover:border-primary"
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
              className="w-full sm:flex-1 p-3 hover:bg-orange-50 hover:border-secondary"
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
