import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export type TrendingDebate = {
  id: number;
  partyId: number;
  partyShortName: string;
  topic: string;
  totalDebates: number;
  partyVotes: number;
  citizenVotes: number;
  updatedAt: Date;
};

export default function TrendingDebateCard({ debate }: { debate: TrendingDebate }) {
  const totalVotes = debate.partyVotes + debate.citizenVotes;
  const partyPercentage = totalVotes > 0 ? Math.round((debate.partyVotes / totalVotes) * 100) : 50;
  const citizenPercentage = totalVotes > 0 ? 100 - partyPercentage : 50;
  
  const getPartyBgColor = () => {
    switch (debate.partyShortName) {
      case "PAP":
        return "bg-blue-100";
      case "WP":
        return "bg-blue-100";
      case "PSP":
        return "bg-red-100";
      default:
        return "bg-blue-100";
    }
  };
  
  const getPartyTextColor = () => {
    switch (debate.partyShortName) {
      case "PAP":
        return "text-blue-700";
      case "WP":
        return "text-blue-700";
      case "PSP":
        return "text-red-700";
      default:
        return "text-blue-700";
    }
  };
  
  const formattedDate = formatDistanceToNow(new Date(debate.updatedAt), { addSuffix: true });
  
  return (
    <Card className="hover:shadow-md transition">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <div className={`w-10 h-10 ${getPartyBgColor()} rounded-full flex items-center justify-center mr-3`}>
              <span className={`${getPartyTextColor()} font-bold text-sm`}>{debate.partyShortName}</span>
            </div>
            <div>
              <h3 className="font-semibold">{debate.topic}</h3>
              <p className="text-xs text-neutral-500">{debate.totalDebates} citizen debates</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">{partyPercentage}%</span>
            <div className="w-20 h-2 bg-neutral-200 rounded-full overflow-hidden">
              <div className="bg-primary h-full" style={{ width: `${partyPercentage}%` }}></div>
            </div>
            <span className="text-sm font-medium">{citizenPercentage}%</span>
          </div>
        </div>
        <p className="text-sm text-neutral-600 mb-3">
          Citizens debating {debate.partyShortName}'s positions on {debate.topic.toLowerCase()}.
        </p>
        <div className="flex justify-between">
          <span className="text-xs text-neutral-500 flex items-center">
            <Clock className="h-3 w-3 mr-1" /> Updated {formattedDate}
          </span>
          <Button variant="link" size="sm" className="text-primary font-medium hover:underline">
            View Summary
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
