import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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
  
  const startDebateMutation = useMutation({
    mutationFn: async (partyId: number) => {
      const res = await apiRequest("POST", "/api/debates", { partyId });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Debate started",
        description: `You are now debating with ${party.name}.`,
      });
      setLocation(`/debate/${data.id}`);
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
    startDebateMutation.mutate(party.id);
  };
  
  const getBgColor = () => {
    switch (party.shortName) {
      case "PAP":
        return "bg-white";
      case "WP":
        return "bg-blue-100";
      case "PSP":
        return "bg-red-100";
      default:
        return "bg-white";
    }
  };
  
  const getTextColor = () => {
    switch (party.shortName) {
      case "PAP":
        return "text-primary";
      case "WP":
        return "text-blue-700";
      case "PSP":
        return "text-red-700";
      default:
        return "text-primary";
    }
  };
  
  return (
    <Card className="hover:shadow-md transition cursor-pointer">
      <CardContent className="p-5">
        <div className="flex items-center mb-3">
          <div className={`w-12 h-12 ${getBgColor()} rounded-full flex items-center justify-center mr-3 border border-neutral-200`}>
            <span className={`${getTextColor()} font-bold`}>{party.shortName}</span>
          </div>
          <h3 className="text-lg font-semibold">{party.name}</h3>
        </div>
        <p className="text-neutral-600 text-sm">{party.description}</p>
        <Button 
          onClick={startDebate}
          className="mt-4 w-full"
          disabled={startDebateMutation.isPending}
        >
          {startDebateMutation.isPending ? "Starting..." : "Start Debate"}
        </Button>
      </CardContent>
    </Card>
  );
}
