import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DebateSummary as DebateSummaryType } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DebateSummaryProps = {
  debateId: string;
  summary: DebateSummaryType;
  partyName: string;
  partyShortName: string;
  topic?: string; // Optional topic to determine mode
};

export default function DebateSummaryTabbed({ 
  debateId, 
  summary, 
  partyName,
  partyShortName,
  topic
}: DebateSummaryProps) {
  // Debug the summary structure
  console.log("DebateSummaryTabbed received summary:", summary);
  
  // Ensure summary has all required properties
  const validSummary = summary && (
    Array.isArray(summary.partyArguments) || 
    Array.isArray(summary.citizenArguments) ||
    Array.isArray(summary.keyPoints) ||
    summary.stakeholderImpact ||
    summary.policyConsequences ||
    summary.conclusion
  );
  
  if (!validSummary) {
    console.log("Summary appears to be invalid or incomplete:", summary);
  }
  const { toast } = useToast();
  
  // Handle regenerating a summary if it failed
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      // Always use debate mode regardless of topic name
      const mode = "debate";
      
      console.log(`Regenerating summary with mode: ${mode}`);
      
      // Pass the mode parameter to the regenerate endpoint
      const res = await apiRequest("POST", `/api/debates/s/${debateId}/regenerate-summary`, { mode });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Summary regenerated",
        description: "A new summary has been generated for your debate.",
      });
      // Force page refresh to show new summary
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Could not regenerate summary: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Safety check: ensure summary exists and has required properties
  if (!summary || !summary.partyArguments || !summary.citizenArguments) {
    const isFallbackSummary = summary && Object.keys(summary).length > 0;
    
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Your Debate Summary</h3>
          
          {isFallbackSummary ? (
            <div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="mr-3 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">Summary Generation Issue</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      We couldn't generate a complete summary for your debate. The AI service might be experiencing high demand or other issues.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={() => regenerateMutation.mutate()}
                className="w-full mb-2"
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating Summary...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2v6h-6"></path>
                      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                      <path d="M3 22v-6h6"></path>
                      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                    </svg>
                    Regenerate Summary
                  </span>
                )}
              </Button>
              
              <p className="text-xs text-neutral-500 text-center">
                Try regenerating the summary to get a complete analysis of your debate.
              </p>
            </div>
          ) : (
            <p className="text-neutral-600">The summary is still being generated or is unavailable. Please try again in a moment.</p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // State to track which option user voted for
  const [userVote, setUserVote] = useState<"party" | "citizen" | null>(null);
  
  const voteMutation = useMutation({
    mutationFn: async (vote: { votedFor: "party" | "citizen" }) => {
      const res = await apiRequest("POST", `/api/debates/s/${debateId}/vote`, vote);
      return await res.json();
    },
    onSuccess: (_, variables) => {
      // Set the user's vote when successful
      setUserVote(variables.votedFor);
      toast({
        title: "Vote recorded",
        description: "Thank you for your vote!",
      });
    },
    onError: (error: Error) => {
      // Reset the user's vote on error
      setUserVote(null);
      toast({
        title: "Error",
        description: `Could not record vote: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleVote = (votedFor: "party" | "citizen") => {
    // Set the vote immediately for instant feedback
    setUserVote(votedFor);
    voteMutation.mutate({ votedFor });
  };
  
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Your Debate Summary</h3>
        
        <Tabs defaultValue="arguments" className="w-full">
          {/* Scrollable tab layout for mobile with horizontal overflow */}
          <div className="overflow-x-auto pb-2 mb-2">
            <TabsList className="flex whitespace-nowrap mb-2">
              <TabsTrigger value="arguments" className="px-3 py-1.5 min-w-max">Arguments</TabsTrigger>
              <TabsTrigger value="key-points" className="px-3 py-1.5 min-w-max">Key Points</TabsTrigger>
              <TabsTrigger value="stakeholders" className="px-3 py-1.5 min-w-max">Stakeholders</TabsTrigger>
              <TabsTrigger value="consequences" className="px-3 py-1.5 min-w-max">Consequences</TabsTrigger>
              <TabsTrigger value="conclusion" className="px-3 py-1.5 min-w-max">Conclusion</TabsTrigger>
            </TabsList>
          </div>
          
          {/* TAB 1: Key Arguments Summary */}
          <TabsContent value="arguments" className="mt-0 max-h-[65vh] overflow-y-auto p-2 border border-neutral-100 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-neutral-200 rounded-lg p-4">
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
              
              <div className="border border-neutral-200 rounded-lg p-4">
                <h4 className="text-md font-medium text-neutral-800 mb-3 flex items-center">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2">
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
          </TabsContent>
          
          {/* TAB 2: Point-by-Point Comparison */}
          <TabsContent value="key-points" className="mt-0 max-h-[65vh] overflow-y-auto p-2 border border-neutral-100 rounded-lg">
            {summary.keyPoints && summary.keyPoints.length > 0 ? (
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
                          <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center mr-2">
                            <span className="text-white font-bold text-xs">C</span>
                          </div>
                          <span className="text-sm font-medium text-neutral-800">Your Position</span>
                        </div>
                        <p className="text-sm text-neutral-700">{point.citizenPosition}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-neutral-500">
                No point-by-point comparison available for this debate.
              </div>
            )}
          </TabsContent>
          
          {/* TAB 3: Stakeholder Impact - Who will be happy/sad */}
          <TabsContent value="stakeholders" className="mt-0 max-h-[65vh] overflow-y-auto p-2 border border-neutral-100 rounded-lg">
            {summary.stakeholderImpact ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Party Impact */}
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="bg-neutral-50 p-3 border-b border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center mr-2">
                        <span className="text-white font-bold text-xs">P</span>
                      </div>
                      <h5 className="font-medium text-neutral-800">{partyShortName} Policy Impact</h5>
                    </div>
                  </div>
                  <div className="p-4">
                    {/* Happy Groups */}
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-green-100 border border-green-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-green-600 font-bold text-xs">+</span>
                        </div>
                        <span className="text-sm font-medium text-green-700">Who would be happy</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {summary.stakeholderImpact.party.happy.map((group, index) => (
                          <li key={index} className="text-sm text-neutral-700 list-disc">{group}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Sad Groups */}
                    <div>
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-red-100 border border-red-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-red-600 font-bold text-xs">-</span>
                        </div>
                        <span className="text-sm font-medium text-red-700">Who would be unhappy</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {summary.stakeholderImpact.party.sad.map((group, index) => (
                          <li key={index} className="text-sm text-neutral-700 list-disc">{group}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Citizen Impact */}
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="bg-neutral-50 p-3 border-b border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center mr-2">
                        <span className="text-white font-bold text-xs">C</span>
                      </div>
                      <h5 className="font-medium text-neutral-800">Your Policy Impact</h5>
                    </div>
                  </div>
                  <div className="p-4">
                    {/* Happy Groups */}
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-green-100 border border-green-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-green-600 font-bold text-xs">+</span>
                        </div>
                        <span className="text-sm font-medium text-green-700">Who would be happy</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {summary.stakeholderImpact.citizen.happy.map((group, index) => (
                          <li key={index} className="text-sm text-neutral-700 list-disc">{group}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Sad Groups */}
                    <div>
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-red-100 border border-red-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-red-600 font-bold text-xs">-</span>
                        </div>
                        <span className="text-sm font-medium text-red-700">Who would be unhappy</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {summary.stakeholderImpact.citizen.sad.map((group, index) => (
                          <li key={index} className="text-sm text-neutral-700 list-disc">{group}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-neutral-500">
                No stakeholder impact analysis available for this debate.
              </div>
            )}
          </TabsContent>
          
          {/* TAB 4: Policy Consequences */}
          <TabsContent value="consequences" className="mt-0 max-h-[65vh] overflow-y-auto p-2 border border-neutral-100 rounded-lg">
            {summary.policyConsequences ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Party Consequences */}
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="bg-neutral-50 p-3 border-b border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center mr-2">
                        <span className="text-white font-bold text-xs">P</span>
                      </div>
                      <h5 className="font-medium text-neutral-800">{partyShortName} Policy Consequences</h5>
                    </div>
                  </div>
                  <div className="p-4">
                    {/* Positive Consequences */}
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-green-100 border border-green-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-green-600 font-bold text-xs">✓</span>
                        </div>
                        <span className="text-sm font-medium text-green-700">Positive consequences</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {summary.policyConsequences.party.positive.map((consequence, index) => (
                          <li key={index} className="text-sm text-neutral-700 list-disc">{consequence}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Negative Consequences */}
                    <div>
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-red-100 border border-red-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-red-600 font-bold text-xs">✗</span>
                        </div>
                        <span className="text-sm font-medium text-red-700">Negative consequences</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {summary.policyConsequences.party.negative.map((consequence, index) => (
                          <li key={index} className="text-sm text-neutral-700 list-disc">{consequence}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Citizen Consequences */}
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="bg-neutral-50 p-3 border-b border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center mr-2">
                        <span className="text-white font-bold text-xs">C</span>
                      </div>
                      <h5 className="font-medium text-neutral-800">Your Policy Consequences</h5>
                    </div>
                  </div>
                  <div className="p-4">
                    {/* Positive Consequences */}
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-green-100 border border-green-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-green-600 font-bold text-xs">✓</span>
                        </div>
                        <span className="text-sm font-medium text-green-700">Positive consequences</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {summary.policyConsequences.citizen.positive.map((consequence, index) => (
                          <li key={index} className="text-sm text-neutral-700 list-disc">{consequence}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Negative Consequences */}
                    <div>
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-red-100 border border-red-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-red-600 font-bold text-xs">✗</span>
                        </div>
                        <span className="text-sm font-medium text-red-700">Negative consequences</span>
                      </div>
                      <ul className="space-y-1 pl-7">
                        {summary.policyConsequences.citizen.negative.map((consequence, index) => (
                          <li key={index} className="text-sm text-neutral-700 list-disc">{consequence}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-neutral-500">
                No policy consequences analysis available for this debate.
              </div>
            )}
          </TabsContent>
          
          {/* TAB 5: Final Conclusion */}
          <TabsContent value="conclusion" className="mt-0 max-h-[65vh] overflow-y-auto p-2 border border-neutral-100 rounded-lg">
            {summary.conclusion ? (
              <div>
                <div className="flex flex-col items-center mb-6 border border-neutral-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <div className={`w-10 h-10 ${
                      summary.conclusion.outcome === 'party' 
                        ? 'bg-primary' 
                        : 'bg-orange-500'
                    } rounded-full flex items-center justify-center mr-2`}>
                      <span className="text-white font-bold text-lg">{
                      summary.conclusion.outcome === 'party' 
                        ? 'P' 
                        : 'C'
                      }</span>
                    </div>
                    <span className="text-lg font-semibold">
                      {summary.conclusion.outcome === 'party' 
                        ? `${partyName} made the stronger case` 
                        : 'Your arguments were more compelling'}
                    </span>
                  </div>
                  
                  <div className="mt-3">
                    <p className="text-sm text-neutral-700">{summary.conclusion.reasoning}</p>
                  </div>
                </div>
                
                {summary.conclusion.evaluation && (
                  <div className="mb-4 space-y-4 border border-neutral-200 rounded-lg p-4">
                    <h5 className="font-medium text-neutral-800">Evaluation Criteria</h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Logical Soundness */}
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <div className="w-5 h-5 bg-blue-100 border border-blue-200 rounded-full flex items-center justify-center mr-2">
                            <span className="text-blue-600 font-bold text-xs">L</span>
                          </div>
                          <span className="text-sm font-medium text-blue-700">Logical Soundness</span>
                        </div>
                        <p className="text-sm text-neutral-700">{summary.conclusion.evaluation.logicalSoundness}</p>
                      </div>
                      
                      {/* Emotional Reasoning */}
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <div className="w-5 h-5 bg-purple-100 border border-purple-200 rounded-full flex items-center justify-center mr-2">
                            <span className="text-purple-600 font-bold text-xs">E</span>
                          </div>
                          <span className="text-sm font-medium text-purple-700">Emotional Reasoning</span>
                        </div>
                        <p className="text-sm text-neutral-700">{summary.conclusion.evaluation.emotionalReasoning}</p>
                      </div>
                      
                      {/* Key Point Resolution */}
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <div className="w-5 h-5 bg-yellow-100 border border-yellow-200 rounded-full flex items-center justify-center mr-2">
                            <span className="text-yellow-600 font-bold text-xs">K</span>
                          </div>
                          <span className="text-sm font-medium text-yellow-700">Key Point Resolution</span>
                        </div>
                        <p className="text-sm text-neutral-700">{summary.conclusion.evaluation.keyPointResolution}</p>
                      </div>
                      
                      {/* Tone and Clarity */}
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <div className="w-5 h-5 bg-indigo-100 border border-indigo-200 rounded-full flex items-center justify-center mr-2">
                            <span className="text-indigo-600 font-bold text-xs">T</span>
                          </div>
                          <span className="text-sm font-medium text-indigo-700">Tone and Clarity</span>
                        </div>
                        <p className="text-sm text-neutral-700">{summary.conclusion.evaluation.toneAndClarity}</p>
                      </div>
                      
                      {/* Pragmatism */}
                      <div className="space-y-1 md:col-span-2">
                        <div className="flex items-center">
                          <div className="w-5 h-5 bg-green-100 border border-green-200 rounded-full flex items-center justify-center mr-2">
                            <span className="text-green-600 font-bold text-xs">P</span>
                          </div>
                          <span className="text-sm font-medium text-green-700">Pragmatism</span>
                        </div>
                        <p className="text-sm text-neutral-700">{summary.conclusion.evaluation.pragmatism}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {summary.conclusion.actionRecommendations && summary.conclusion.actionRecommendations.length > 0 && (
                  <div className="border border-neutral-200 rounded-lg p-4">
                    <h5 className="font-medium text-neutral-800 mb-2">Action Recommendations</h5>
                    <ul className="space-y-1 pl-5">
                      {summary.conclusion.actionRecommendations.map((recommendation, index) => (
                        <li key={index} className="text-sm text-neutral-700 list-disc">{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-neutral-500">
                No conclusion available for this debate.
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Vote for which side made better arguments */}
        <div className="mt-8 border-t border-neutral-200 pt-6">
          <h5 className="text-center font-semibold mb-4">Which side made the better arguments?</h5>
          
          <div className="flex justify-center space-x-4">
            <Button
              variant={userVote === 'party' ? 'default' : 'outline'}
              className="flex items-center"
              onClick={() => handleVote('party')}
              disabled={voteMutation.isPending}
            >
              {userVote === 'party' && <Check className="mr-2 h-4 w-4" />}
              {partyShortName}
            </Button>
            
            <Button
              variant={userVote === 'citizen' ? 'default' : 'outline'}
              className="flex items-center"
              onClick={() => handleVote('citizen')}
              disabled={voteMutation.isPending}
            >
              {userVote === 'citizen' && <Check className="mr-2 h-4 w-4" />}
              Citizen (You)
            </Button>
          </div>
          
          {voteMutation.isPending && (
            <p className="text-center text-sm text-neutral-500 mt-2">
              Recording your vote...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}