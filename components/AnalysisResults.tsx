'use client'

interface AnalysisResultsProps {
  result: string | null
  isAnalyzing: boolean
  error: string | null
  isLive?: boolean
  timestamp?: Date
}

export default function AnalysisResults({
  result,
  isAnalyzing,
  error,
  isLive = false,
  timestamp,
}: AnalysisResultsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">
          {isLive ? 'Live Analysis Results' : 'Analysis Results'}
        </h2>
        {isLive && result && (
          <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live
          </span>
        )}
      </div>

      <div className="min-h-[400px]">
        {isAnalyzing && !result && (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {isLive ? 'Analyzing live stream...' : 'Analyzing video with Grok AI...'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              {isLive ? 'Processing current frame' : 'This may take a few moments'}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-red-400 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {timestamp && (
              <div className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2">
                Analysis time: {timestamp.toLocaleString()}
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-[500px] overflow-y-auto">
              <div className="prose dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {result}
                </div>
              </div>
            </div>
            {isLive && (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                Results update automatically as new frames are analyzed
              </div>
            )}
          </div>
        )}

        {!result && !isAnalyzing && !error && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-gray-500 dark:text-gray-400">
            <svg
              className="h-16 w-16 mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>
              {isLive
                ? 'Start live analysis to see results here'
                : 'Upload a video or start live stream to see analysis results here'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
