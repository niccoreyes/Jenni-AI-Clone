import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDocumentStats,
  getGetDocumentStatsQueryKey,
  useListDocuments,
  getListDocumentsQueryKey,
  useCreateDocument,
  useDeleteDocument,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStyle, setNewStyle] = useState("APA7");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetDocumentStats({
    query: { queryKey: getGetDocumentStatsQueryKey() }
  });

  const { data: documents, isLoading: docsLoading } = useListDocuments({
    query: { queryKey: getListDocumentsQueryKey() }
  });

  const createDocument = useCreateDocument({
    mutation: {
      onSuccess: (doc) => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDocumentStatsQueryKey() });
        setNewDocOpen(false);
        setNewTitle("");
        setLocation(`/write/${doc.id}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create document", variant: "destructive" });
      },
    }
  });

  const deleteDocument = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDocumentStatsQueryKey() });
        toast({ title: "Document deleted" });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
      },
    }
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createDocument.mutate({ data: { title: newTitle.trim(), citationStyle: newStyle as "APA7" | "MLA9" | "Chicago17" | "IEEE" | "Harvard" } });
  };

  const filteredDocs = documents?.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const styleColors: Record<string, string> = {
    APA7: "bg-primary/10 text-primary border-primary/20",
    MLA9: "bg-accent/10 text-accent border-accent/20",
    Chicago17: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    IEEE: "bg-chart-4/10 text-chart-4 border-chart-4/20",
    Harvard: "bg-chart-5/10 text-chart-5 border-chart-5/20",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">OJ</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">OpenJenni</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/settings")} data-testid="nav-settings">
            Settings
          </Button>
          <Button size="sm" onClick={() => setNewDocOpen(true)} data-testid="button-new-document">
            New Document
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-1">Your research workspace</h2>
          <p className="text-sm text-muted-foreground">Documents, citations, and AI assistance in one place.</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-lg p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))
          ) : (
            <>
              <div className="bg-card border border-card-border rounded-lg p-4" data-testid="stat-documents">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Documents</p>
                <p className="text-2xl font-semibold text-foreground">{stats?.totalDocuments ?? 0}</p>
              </div>
              <div className="bg-card border border-card-border rounded-lg p-4" data-testid="stat-words">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Words Written</p>
                <p className="text-2xl font-semibold text-foreground">{(stats?.totalWords ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-card border border-card-border rounded-lg p-4" data-testid="stat-citations">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Citations</p>
                <p className="text-2xl font-semibold text-foreground">{stats?.totalCitations ?? 0}</p>
              </div>
              <div className="bg-card border border-card-border rounded-lg p-4" data-testid="stat-pdfs">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">PDFs Uploaded</p>
                <p className="text-2xl font-semibold text-foreground">{stats?.totalPdfs ?? 0}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">All Documents</h3>
          <Input
            type="search"
            placeholder="Search documents..."
            className="w-56 h-8 text-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-search-documents"
          />
        </div>

        {docsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground text-sm mb-3">
              {searchQuery ? "No documents match your search." : "No documents yet. Create your first one."}
            </p>
            {!searchQuery && (
              <Button size="sm" onClick={() => setNewDocOpen(true)} data-testid="button-create-first">
                Create Document
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map(doc => (
              <div
                key={doc.id}
                className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => setLocation(`/write/${doc.id}`)}
                data-testid={`card-document-${doc.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.wordCount.toLocaleString()} words · Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs border px-1.5 py-0.5 rounded font-medium ${styleColors[doc.citationStyle] ?? ""}`}>
                    {doc.citationStyle}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm("Delete this document?")) {
                        deleteDocument.mutate({ id: doc.id });
                      }
                    }}
                    data-testid={`button-delete-document-${doc.id}`}
                  >
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-3 text-sm opacity-0 group-hover:opacity-100"
                    onClick={e => { e.stopPropagation(); setLocation(`/write/${doc.id}`); }}
                    data-testid={`button-open-document-${doc.id}`}
                  >
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={newDocOpen} onOpenChange={setNewDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                placeholder="Untitled document"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                autoFocus
                data-testid="input-new-doc-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-style">Citation Style</Label>
              <Select value={newStyle} onValueChange={setNewStyle}>
                <SelectTrigger id="doc-style" data-testid="select-citation-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APA7">APA 7th Edition</SelectItem>
                  <SelectItem value="MLA9">MLA 9th Edition</SelectItem>
                  <SelectItem value="Chicago17">Chicago 17th Edition</SelectItem>
                  <SelectItem value="IEEE">IEEE</SelectItem>
                  <SelectItem value="Harvard">Harvard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDocOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createDocument.isPending}
              data-testid="button-create-document-confirm"
            >
              {createDocument.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
