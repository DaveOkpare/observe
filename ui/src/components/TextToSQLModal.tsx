"use client";

import React, { useState } from "react";
import { queryTracesWithText, type TextToSQLResponse } from "@/lib/api";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table";
import { Badge } from "@/components/Badge";
import { Search, Sparkles, Copy, AlertCircle, Database, Clock } from "lucide-react";

interface TextToSQLModalProps {
  children: React.ReactNode;
}

export default function TextToSQLModal({ children }: TextToSQLModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TextToSQLResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const exampleQueries = [
    "Show me traces from the last hour",
    "Find slow database operations taking longer than 1 second",
    "Show me all Logfire traces with AI conversations",
    "Find traces with errors from pydantic-ai-test service",
    "Show me the 10 most recent traces"
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await queryTracesWithText(query.trim());
      setResults(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const copyResults = () => {
    if (results?.rows) {
      navigator.clipboard.writeText(JSON.stringify(results.rows, null, 2));
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-blue-600" />
            AI-Powered Trace Search
          </DrawerTitle>
          <DrawerDescription>
            Ask questions in natural language and get SQL results from your observability data.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          {/* Search Input */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question about your traces..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
                disabled={loading}
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="gap-2"
              >
                <Search className="size-4" />
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {/* Example Queries */}
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Try these example queries:
              </p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(example)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1 rounded-full transition-colors"
                    disabled={loading}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="flex-1 overflow-hidden">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800 mb-2">
                  <AlertCircle className="size-4" />
                  <h3 className="font-medium">Query Failed</h3>
                </div>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {results && (
              <div className="space-y-4 h-full flex flex-col">
                {/* Results Header */}
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Database className="size-4 text-green-700" />
                    <h3 className="font-medium text-green-800">
                      Query Results
                    </h3>
                    <Badge variant="success" className="rounded-full">
                      {results.count} results
                    </Badge>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={copyResults}
                    className="gap-2 px-3 py-1 text-sm"
                  >
                    <Copy className="size-3" />
                    Copy JSON
                  </Button>
                </div>

                {/* Results Table */}
                {results.rows.length > 0 ? (
                  <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
                    <TableRoot>
                      <Table>
                        <TableHead>
                          <TableRow>
                            {Object.keys(results.rows[0]).map((key) => (
                              <TableHeaderCell key={key} className="sticky top-0 bg-white dark:bg-gray-900">
                                {key}
                              </TableHeaderCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {results.rows.map((row, index) => (
                            <TableRow key={index}>
                              {Object.entries(row).map(([key, value]) => (
                                <TableCell key={key} className="max-w-xs">
                                  <ResultValue value={value} />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableRoot>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <Database className="size-8 mx-auto mb-2 opacity-50" />
                      <p>No results found</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!results && !error && !loading && (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <Sparkles className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="mb-1">Ask a question to get started</p>
                  <p className="text-sm">AI will convert your question to SQL and return results</p>
                </div>
              </div>
            )}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function ResultValue({ value }: { value: any }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic">null</span>;
  }

  if (typeof value === 'string' && value.length > 100) {
    return (
      <div className="group relative">
        <span className="truncate block" title={value}>
          {value.substring(0, 100)}...
        </span>
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded truncate">
        {JSON.stringify(value)}
      </div>
    );
  }

  if (typeof value === 'number') {
    return <span className="font-mono">{value.toLocaleString()}</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'success' : 'error'} className="text-xs">
        {value.toString()}
      </Badge>
    );
  }

  // Handle timestamps
  if (typeof value === 'string' && (value.includes('T') || value.includes(':'))) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return (
          <div className="flex items-center gap-1 text-xs">
            <Clock className="size-3 text-gray-400" />
            <span title={value}>{date.toLocaleString()}</span>
          </div>
        );
      }
    } catch {
      // Not a date, fall through
    }
  }

  return <span>{String(value)}</span>;
}