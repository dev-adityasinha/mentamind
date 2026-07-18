"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Heart, AlertTriangle, MoreVertical, Send, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { 
  fetchPosts, 
  createPost, 
  toggleLike, 
  fetchComments, 
  createComment, 
  reportContent,
  deletePost,
  PostResponse,
  CommentResponse 
} from "@/lib/api/forum";

// --- Components ---

function Badge({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function PostCard({ 
  post, 
  onLike,
  onCommentClick,
  onDelete
}: { 
  post: PostResponse; 
  onLike: (id: string) => void;
  onCommentClick: (post: PostResponse) => void;
  onDelete: (id: string) => void;
}) {
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [showReport, setShowReport] = useState(false);

  // Sync likes if updated from polling
  useEffect(() => {
    setLikes(post.likes);
  }, [post.likes]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deletePost(post.id);
      onDelete(post.id);
    } catch (e) {
      alert("Failed to delete post");
    }
  };

  const handleLike = async () => {
    try {
      const prevLiked = isLiked;
      setIsLiked(!prevLiked);
      setLikes((l) => (prevLiked ? l - 1 : l + 1));
      const res = await toggleLike(post.id);
      setIsLiked(res.status === "liked");
      setLikes(res.likes);
    } catch (e) {
      console.error(e);
      // Revert on error
      setIsLiked(isLiked);
      setLikes(likes);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setIsReporting(true);
    try {
      await reportContent("post", post.id, reportReason);
      alert("Report submitted successfully.");
      setShowReport(false);
      setReportReason("");
    } catch (e) {
      alert("Failed to submit report.");
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-5 transition-shadow hover:shadow-md">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-text-primary">
              {post.is_anonymous || !post.author_id ? "Anonymous User" : "Community Member"}
            </span>
            <span className="text-xs text-text-secondary">
              • {new Date(post.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge className="bg-brand/10 text-brand capitalize">{post.category}</Badge>
            {post.moods?.map((m) => (
              <Badge key={m} className="bg-secondary/10 text-secondary">{m}</Badge>
            ))}
            {post.tags?.map((t) => (
              <Badge key={t} className="bg-surface text-text-secondary border border-border">#{t}</Badge>
            ))}
          </div>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowReport(!showReport)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface rounded-full transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          
          {showReport && (
            <div className="absolute right-0 top-8 w-64 bg-white shadow-lg border border-border rounded-lg p-3 z-10">
              <h4 className="text-sm font-medium mb-2 text-text-primary flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Options
              </h4>
              
              {post.is_mine && (
                <div className="mb-4 pb-4 border-b border-border">
                  <Button variant="destructive" size="sm" onClick={handleDelete} className="w-full">
                    Delete Post
                  </Button>
                </div>
              )}
              
              <h5 className="text-xs font-medium text-text-secondary mb-2">Report Content</h5>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Why are you reporting this?"
                className="w-full text-sm rounded-md border border-border p-2 mb-2 focus:ring-1 focus:ring-brand focus:outline-none"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="secondary" onClick={() => setShowReport(false)}>Cancel</Button>
                <Button size="sm" onClick={handleReport} isLoading={isReporting}>Submit</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-text-primary text-[15px] leading-relaxed mb-4 whitespace-pre-wrap">
        {post.content}
      </p>

      <div className="flex items-center gap-6 pt-3 border-t border-border/50">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            isLiked ? "text-error" : "text-text-secondary hover:text-error"
          }`}
        >
          <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
          {likes}
        </button>
        <button 
          onClick={() => onCommentClick(post)}
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-brand transition-colors"
        >
          <MessageSquare className="h-5 w-5" />
          {post.reply_count} Replies
        </button>
      </div>
    </div>
  );
}


function CommentsModal({ 
  post, 
  onClose,
  onCommentAdded
}: { 
  post: PostResponse; 
  onClose: () => void;
  onCommentAdded: () => void;
}) {
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchIt = () => {
      fetchComments(post.id)
        .then(setComments)
        .finally(() => setIsLoading(false));
    };
    fetchIt();
    const interval = setInterval(fetchIt, 5000);
    return () => clearInterval(interval);
  }, [post.id]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    try {
      const comment = await createComment(post.id, newComment, isAnonymous);
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      onCommentAdded();
    } catch (e) {
      alert("Failed to post comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-semibold text-lg text-text-primary">Replies</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-surface/50 p-4 rounded-lg mb-6 border border-border">
            <p className="text-text-primary text-sm whitespace-pre-wrap">{post.content}</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-text-secondary py-8">No replies yet. Be the first!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-brand font-medium text-xs">
                    {c.is_anonymous || !c.author_id ? "A" : "M"}
                  </span>
                </div>
                <div className="flex-1 bg-surface rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm text-text-primary">
                      {c.is_anonymous || !c.author_id ? "Anonymous" : "Member"}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface/30">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a reply..."
            className="w-full text-sm rounded-lg border border-border p-3 mb-3 focus:ring-1 focus:ring-brand focus:outline-none resize-none"
            rows={3}
          />
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
              <input 
                type="checkbox" 
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded text-brand focus:ring-brand w-4 h-4" 
              />
              Reply Anonymously
            </label>
            <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!newComment.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- Main Page ---

export default function ForumPage() {
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMethod, setSortMethod] = useState<"recent" | "trending">("recent");
  const [selectedPost, setSelectedPost] = useState<PostResponse | null>(null);

  // New Post State
  const [isComposing, setIsComposing] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [moodsInput, setMoodsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = ["general", "anxiety", "depression", "stress", "work", "relationships", "grief"];

  const loadPosts = useCallback(async (reset = false) => {
    try {
      const currentCursor = reset ? null : cursor;
      if (reset) setIsLoading(true);
      else setIsFetchingMore(true);

      const res = await fetchPosts(currentCursor, 20, activeCategory || undefined, searchQuery || undefined, sortMethod);
      
      if (reset) {
        setPosts(res.posts);
      } else {
        setPosts((prev) => [...prev, ...res.posts]);
      }
      
      setCursor(res.next_cursor);
      setHasMore(!!res.next_cursor);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [cursor, activeCategory, searchQuery, sortMethod]);

  useEffect(() => {
    loadPosts(true);
  }, [activeCategory, sortMethod, loadPosts]);

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPosts(null, 20, activeCategory || undefined, searchQuery || undefined, sortMethod)
        .then(res => {
          setPosts(prevPosts => {
            const newPosts = [...prevPosts];
            res.posts.forEach(freshPost => {
              const index = newPosts.findIndex(p => p.id === freshPost.id);
              if (index !== -1) {
                newPosts[index] = { 
                  ...newPosts[index], 
                  likes: freshPost.likes, 
                  reply_count: freshPost.reply_count 
                };
              } else if (!searchQuery && sortMethod === "recent" && !prevPosts.find(p => p.id === freshPost.id)) {
                // Prepend new posts if we are sorting by recent and no search query is active
                newPosts.unshift(freshPost);
              }
            });
            // Sort again if trending
            if (sortMethod === "trending") {
              newPosts.sort((a, b) => b.likes - a.likes || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } else {
              newPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }
            return newPosts;
          });
        })
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeCategory, searchQuery, sortMethod]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPosts(true);
  };

  const handleCreatePost = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    
    // Parse tags and moods from comma separated inputs
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const moods = moodsInput.split(",").map(m => m.trim()).filter(Boolean);
    
    try {
      const newPost = await createPost(content, category, isAnonymous, tags, moods);
      setPosts([newPost, ...posts]);
      setIsComposing(false);
      setContent("");
      setTagsInput("");
      setMoodsInput("");
      setCategory("general");
      setIsAnonymous(false);
    } catch (e) {
      alert("Failed to create post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">AnonyMenta</h1>
          <p className="text-text-secondary mt-1">A safe space to share and support each other.</p>
        </div>
        <Button onClick={() => setIsComposing(!isComposing)}>
          {isComposing ? "Cancel" : "Create Post"}
        </Button>
      </div>

      {isComposing && (
        <div className="bg-white rounded-xl shadow-md border border-border p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Share your thoughts</h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? You can share completely anonymously."
            className="w-full text-sm rounded-xl border border-border p-4 mb-4 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none resize-y min-h-[120px]"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Category</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm rounded-lg border border-border p-2 focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tags (comma separated)</label>
              <input 
                type="text" 
                value={tagsInput} 
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. mindfulness, help"
                className="w-full text-sm rounded-lg border border-border p-2 focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Moods (comma separated)</label>
              <input 
                type="text" 
                value={moodsInput} 
                onChange={(e) => setMoodsInput(e.target.value)}
                placeholder="e.g. anxious, tired"
                className="w-full text-sm rounded-lg border border-border p-2 focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
              <input 
                type="checkbox" 
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded text-brand focus:ring-brand w-4 h-4" 
              />
              Post Anonymously
            </label>
            <Button onClick={handleCreatePost} isLoading={isSubmitting} disabled={!content.trim()}>
              Publish
            </Button>
          </div>
        </div>
      )}

      {/* Search and Sort */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            className="flex-1 text-sm rounded-lg border border-border p-2 focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <div className="flex bg-surface rounded-lg p-1 border border-border shrink-0">
          <button 
            onClick={() => setSortMethod("recent")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${sortMethod === "recent" ? "bg-white shadow-sm text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Recent
          </button>
          <button 
            onClick={() => setSortMethod("trending")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${sortMethod === "trending" ? "bg-white shadow-sm text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
          >
            Trending
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex overflow-x-auto pb-4 mb-4 gap-2 scrollbar-hide">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategory === null 
              ? "bg-text-primary text-white" 
              : "bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          All Topics
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors capitalize ${
              activeCategory === c 
                ? "bg-text-primary text-white" 
                : "bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-border border-dashed">
          <MessageSquare className="h-12 w-12 text-border mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary">No posts yet</h3>
          <p className="text-text-secondary mt-1">Be the first to share something with the community.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard 
              key={post.id} 
              post={post} 
              onLike={() => {}} 
              onCommentClick={setSelectedPost} 
              onDelete={(id) => setPosts(posts.filter(p => p.id !== id))}
            />
          ))}
          
          {hasMore && (
            <div className="flex justify-center pt-6 pb-12">
              <Button 
                variant="secondary" 
                onClick={() => loadPosts()} 
                isLoading={isFetchingMore}
              >
                Load More Posts
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Comments Modal */}
      {selectedPost && (
        <CommentsModal 
          post={selectedPost} 
          onClose={() => setSelectedPost(null)} 
          onCommentAdded={() => {
            // Optimistically update reply count
            setPosts(posts.map(p => p.id === selectedPost.id ? { ...p, reply_count: p.reply_count + 1 } : p));
          }}
        />
      )}
    </div>
  );
}
