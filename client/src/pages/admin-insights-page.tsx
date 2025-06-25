import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Calendar, BarChart3, TrendingUp } from 'lucide-react';

export default function AdminInsightsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set default date range to last 30 days
  const handleSetLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  // Set default date range to last 7 days
  const handleSetLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const generateInsightsMutation = useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
      return apiRequest('/api/admin/generate-insights', {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Insights Generated",
        description: `Analytics updated for ${data.dateRange.startDate} to ${data.dateRange.endDate}`,
      });
      // Invalidate insights cache to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate insights",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Invalid Date Range",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Invalid Date Range",
        description: "Start date must be before end date",
        variant: "destructive",
      });
      return;
    }

    generateInsightsMutation.mutate({ startDate, endDate });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin: Generate Insights</h1>
        <p className="text-gray-600 mt-2">
          Generate political discourse analytics for a specific date range
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range Selection
          </CardTitle>
          <CardDescription>
            Choose the period for analyzing political debates and citizen discussions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSetLast7Days}>
              Last 7 Days
            </Button>
            <Button variant="outline" onClick={handleSetLast30Days}>
              Last 30 Days
            </Button>
          </div>

          <Button 
            onClick={handleGenerate}
            disabled={generateInsightsMutation.isPending}
            className="w-full"
          >
            {generateInsightsMutation.isPending ? (
              "Generating Insights..."
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                Generate Insights for Selected Period
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analytics Overview
          </CardTitle>
          <CardDescription>
            What gets analyzed when insights are generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Word Cloud Analysis</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Most discussed political topics</li>
                <li>• Citizen policy concerns</li>
                <li>• Issue frequency rankings</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Ministry Accountability</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Ministry-specific inquiry volumes</li>
                <li>• Public attention rankings</li>
                <li>• Policy area breakdown</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}