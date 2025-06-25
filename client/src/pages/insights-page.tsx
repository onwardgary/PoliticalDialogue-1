import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Building2, BarChart3 } from "lucide-react";

interface TopicData {
  text: string;
  value: number;
  ministry?: string;
}

interface MinistryBusyness {
  ministry: string;
  topicCount: number;
  topics: string[];
}

interface InsightsData {
  wordCloudData: TopicData[];
  ministryBusyness: MinistryBusyness[];
  totalDebates: number;
  totalTopics: number;
}

// Simple word cloud component using CSS
function WordCloud({ data }: { data: TopicData[] }) {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="flex flex-wrap gap-2 p-4 min-h-[300px] items-center justify-center">
      {data.slice(0, 50).map((item, index) => {
        const size = Math.max(12, (item.value / maxValue) * 48);
        const opacity = Math.max(0.4, item.value / maxValue);
        
        return (
          <span
            key={index}
            className="inline-block cursor-pointer transition-all hover:scale-110"
            style={{
              fontSize: `${size}px`,
              opacity: opacity,
              color: `hsl(${200 + (index * 7) % 160}, 70%, 50%)`,
              fontWeight: item.value > maxValue * 0.5 ? 'bold' : 'normal'
            }}
            title={`Mentioned ${item.value} times`}
          >
            {item.text}
          </span>
        );
      })}
    </div>
  );
}

function MinistryRanking({ ministries }: { ministries: MinistryBusyness[] }) {
  const maxCount = ministries.length > 0 ? ministries[0].topicCount : 1;
  
  return (
    <div className="space-y-4">
      {ministries.map((ministry, index) => (
        <div key={ministry.ministry} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                #{index + 1}
              </Badge>
              <h4 className="font-medium text-sm">
                {ministry.ministry.replace('Ministry of ', '')}
              </h4>
            </div>
            <div className="text-sm text-muted-foreground">
              {ministry.topicCount} mentions
            </div>
          </div>
          
          <Progress 
            value={(ministry.topicCount / maxCount) * 100} 
            className="h-2"
          />
          
          <div className="flex flex-wrap gap-1">
            {ministry.topics.slice(0, 5).map((topic, topicIndex) => (
              <Badge key={topicIndex} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
            {ministry.topics.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{ministry.topics.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const { data: insights, isLoading, error } = useQuery<InsightsData>({
    queryKey: ['/api/insights'],
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Analyzing debate data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Unable to load insights. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8" />
          Political Discourse Insights
        </h1>
        <p className="text-muted-foreground">
          Based on {insights.totalDebates} completed debates analyzing {insights.totalTopics} unique topics
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Word Cloud */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Most Discussed Topics
            </CardTitle>
            <CardDescription>
              Topics sized by frequency of citizen discussion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WordCloud data={insights.wordCloudData} />
          </CardContent>
        </Card>

        {/* Ministry Busyness */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Ministry Busyness Index
            </CardTitle>
            <CardDescription>
              Ministries ranked by citizen inquiry volume
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights.ministryBusyness.length > 0 ? (
              <MinistryRanking ministries={insights.ministryBusyness} />
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No ministry data available yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{insights.totalDebates}</div>
            <div className="text-sm text-muted-foreground">Total Debates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{insights.totalTopics}</div>
            <div className="text-sm text-muted-foreground">Unique Topics</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{insights.ministryBusyness.length}</div>
            <div className="text-sm text-muted-foreground">Ministries Tracked</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}