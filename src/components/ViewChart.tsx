import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ViewChartProps {
  submissionId: Id<"submissions">;
  height?: number;
}

export function ViewChart({ submissionId, height = 128 }: ViewChartProps) {
  const viewHistory = useQuery(api.viewTrackingHelpers.getViewHistoryForUser, {
    submissionId,
    limit: 24 // Last 24 data points
  });
  
  if (!viewHistory || viewHistory.length < 2) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-white font-medium mb-4">View History</h4>
        <div className="text-gray-400 text-sm">Not enough data for chart (need at least 2 data points)</div>
      </div>
    );
  }
  
  const maxViews = Math.max(...viewHistory.map(v => v.viewCount));
  const minViews = Math.min(...viewHistory.map(v => v.viewCount));
  const viewRange = maxViews - minViews;
  
  // Reverse to show chronological order (oldest to newest)
  const chronologicalData = [...viewHistory].reverse();
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-white font-medium">View History</h4>
        <div className="text-sm text-gray-400">
          {chronologicalData.length} data points
        </div>
      </div>
      
      <div className="relative">
        <div className="flex items-end space-x-1" style={{ height: `${height}px` }}>
          {chronologicalData.map((point, index) => {
            const heightPercent = viewRange > 0 
              ? ((point.viewCount - minViews) / viewRange) * 100 
              : 50;
            const barHeight = Math.max(heightPercent, 2); // Minimum 2% height
            
            return (
              <div
                key={index}
                className="bg-gradient-to-t from-purple-600 to-purple-400 rounded-t flex-1 min-w-0 relative group cursor-pointer"
                style={{
                  height: `${barHeight}%`,
                  minHeight: '4px'
                }}
                title={`${point.viewCount.toLocaleString()} views at ${new Date(point.timestamp).toLocaleString()}`}
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  <div className="font-medium">{point.viewCount.toLocaleString()} views</div>
                  <div className="text-gray-400">{new Date(point.timestamp).toLocaleDateString()}</div>
                  <div className="text-gray-400 text-xs">{point.source}</div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-12">
          <span>{maxViews.toLocaleString()}</span>
          {viewRange > 0 && (
            <span>{Math.round((maxViews + minViews) / 2).toLocaleString()}</span>
          )}
          <span>{minViews.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Growth indicator */}
      {chronologicalData.length >= 2 && (
        <div className="mt-3 flex justify-between items-center text-sm">
          <div className="text-gray-400">
            Tracking since {new Date(chronologicalData[0].timestamp).toLocaleDateString()}
          </div>
          <div className={`font-medium ${
            chronologicalData[chronologicalData.length - 1].viewCount > chronologicalData[0].viewCount
              ? 'text-green-400' : 'text-red-400'
          }`}>
            {chronologicalData[chronologicalData.length - 1].viewCount > chronologicalData[0].viewCount ? '↗' : '↘'} 
            {' '}
            {(
              ((chronologicalData[chronologicalData.length - 1].viewCount - chronologicalData[0].viewCount) / chronologicalData[0].viewCount) * 100
            ).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}
