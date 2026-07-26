"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Sparkles,
  Flame,
  ArrowUp,
  Share2,
  Flag,
  MoreHorizontal,
  Send,
  Loader2,
  Check,
} from "lucide-react";
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
  CommentResponse,
} from "@/lib/api/forum";

// --- Helpers ---

// Label for an author. We only ever know "anonymous" vs "a community member";
// keep the real data model but present it warmly.
function authorLabel(isAnonymous: boolean, authorId: string | null | undefined) {
  return isAnonymous || !authorId ? "Anonymous User" : "Community Member";
}

// Deterministic initials for the avatar badge.
function initials(isAnonymous: boolean, authorId: string | null | undefined) {
  if (isAnonymous || !authorId) return "A";
  // Use the first two hex chars of the id, uppercased, as a stable initial pair.
  const clean = authorId.replace(/[^a-zA-Z0-9]/g, "");
  return (clean.slice(0, 2) || "M").toUpperCase();
}

// Deterministic gradient per author/post so avatars feel distinct but stable.
const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-fuchsia-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-lime-500 to-emerald-600",
];

function avatarGradient(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// Relative "shared Xh ago" style timestamp.
function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}

// --- Small UI atoms ---

function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function Avatar({
  isAnonymous,
  authorId,
  seed,
}: {
  isAnonymous: boolean;
  authorId: string | null | undefined;
  seed: string;
}) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(
        seed,
      )} text-sm font-semibold text-white shadow-sm`}
    >
      {initials(isAnonymous, authorId)}
    </div>
  );
}

// --- Post Card ---

function PostCard({
  post,
  onCommentClick,
  onDelete,
}: {
  post: PostResponse;
  onCommentClick: (post: PostResponse) => void;
  onDelete: (id: string) => void;
}) {
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [shared, setShared] = useState(false);

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

  const handleShare = async () => {
    const shareText = post.content.slice(0, 140);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Community Support",
          text: shareText,
        });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(post.content);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch (e) {
      // User cancelled share sheet or clipboard denied — no-op.
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setIsReporting(true);
    try {
      await reportContent("post", post.id, reportReason);
      alert("Report submitted successfully.");
      setShowReport(false);
      setShowMenu(false);
      setReportReason("");
    } catch (e) {
      alert("Failed to submit report.");
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:shadow-md sm:p-5">
      {/* Header: avatar + name + time + menu */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            isAnonymous={post.is_anonymous || !post.author_id}
            authorId={post.author_id}
            seed={post.author_id || post.id}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary">
                {authorLabel(post.is_anonymous, post.author_id)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-secondary">
              <span>shared {timeAgo(post.created_at)}</span>
              <span>•</span>
              <span className="capitalize">{post.category}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowMenu((s) => !s);
              setShowReport(false);
            }}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            aria-label="Post options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-9 z-10 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface-raised p-3 shadow-lg">
              {post.is_mine && (
                <div className="mb-3 border-b border-border pb-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    className="w-full"
                  >
                    Delete Post
                  </Button>
                </div>
              )}

              {!showReport ? (
                <button
                  onClick={() => setShowReport(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                >
                  <Flag className="h-4 w-4 text-warning" />
                  Report this post
                </button>
              ) : (
                <div>
                  <h5 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <Flag className="h-4 w-4 text-warning" />
                    Report Content
                  </h5>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Why are you reporting this?"
                    className="mb-2 w-full rounded-md border border-border bg-surface p-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowReport(false);
                        setShowMenu(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleReport} isLoading={isReporting}>
                      Submit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="mb-3 whitespace-pre-wrap text-[15px] leading-relaxed text-text-primary">
        {post.content}
      </p>

      {/* Tags / moods */}
      {(post.moods?.length || post.tags?.length) ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {post.moods?.map((m) => (
            <Badge key={m} className="bg-secondary/10 text-secondary">
              {m}
            </Badge>
          ))}
          {post.tags?.map((t) => (
            <Badge key={t} className="border border-border bg-surface text-text-secondary">
              #{t}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            isLiked ? "text-brand" : "text-text-secondary hover:text-brand"
          }`}
        >
          <Sparkles className={`h-[18px] w-[18px] ${isLiked ? "fill-current" : ""}`} />
          <span>
            {likes > 0 ? `${likes} ` : ""}This resonates
          </span>
        </button>

        <button
          onClick={() => onCommentClick(post)}
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-brand"
        >
          <MessageSquare className="h-[18px] w-[18px]" />
          <span>
            {post.reply_count > 0 ? `${post.reply_count} ` : ""}Comments
          </span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-brand"
        >
          {shared ? (
            <Check className="h-[18px] w-[18px] text-brand" />
          ) : (
            <Share2 className="h-[18px] w-[18px]" />
          )}
          <span>{shared ? "Copied" : "Share"}</span>
        </button>

        <button
          onClick={() => {
            setShowMenu(true);
            setShowReport(true);
          }}
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-warning"
        >
          <Flag className="h-[18px] w-[18px]" />
          <span>Report</span>
        </button>
      </div>
    </div>
  );
}

// --- Comments Modal ---

function CommentsModal({
  post,
  onClose,
  onCommentAdded,
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-surface shadow-xl sm:max-h-[85vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-lg font-semibold text-text-primary">Comments</h3>
          <button
            onClick={onClose}
            className="text-text-secondary transition-colors hover:text-text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Original post preview */}
          <div className="mb-2 flex gap-3 rounded-xl border border-border bg-surface-raised/50 p-4">
            <Avatar
              isAnonymous={post.is_anonymous || !post.author_id}
              authorId={post.author_id}
              seed={post.author_id || post.id}
            />
            <div className="min-w-0">
              <div className="mb-1 text-sm font-semibold text-text-primary">
                {authorLabel(post.is_anonymous, post.author_id)}
              </div>
              <p className="whitespace-pre-wrap text-sm text-text-primary">
                {post.content}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-text-secondary">
              No comments yet. Be the first to offer support.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar
                  isAnonymous={c.is_anonymous || !c.author_id}
                  authorId={c.author_id}
                  seed={c.author_id || c.id}
                />
                <div className="flex-1 rounded-xl bg-surface-raised p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">
                      {authorLabel(c.is_anonymous, c.author_id)}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-text-primary">
                    {c.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border bg-surface-raised/30 p-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share a supportive reply..."
            className="mb-3 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-4 w-4 rounded text-brand focus:ring-brand"
              />
              Comment anonymously
            </label>
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!newComment.trim()}
            >
              <Send className="mr-2 h-4 w-4" />
              Comment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sort tabs ---

type SortTab = "hot" | "new" | "top";

const SORT_TABS: { key: SortTab; label: string; icon: typeof Flame }[] = [
  { key: "hot", label: "Hot", icon: Flame },
  { key: "new", label: "New", icon: Sparkles },
  { key: "top", label: "Top", icon: ArrowUp },
];

// --- Main Page ---

export default function ForumPage() {
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortTab, setSortTab] = useState<SortTab>("hot");
  const [selectedPost, setSelectedPost] = useState<PostResponse | null>(null);

  // New Post State
  const [isComposing, setIsComposing] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [moodsInput, setMoodsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    "general",
    "anxiety",
    "depression",
    "stress",
    "work",
    "relationships",
    "grief",
  ];

  // Map the friendly tabs to the backend sort methods.
  // "New" = recent; "Hot" and "Top" both reuse the trending sort.
  const sortMethod: "recent" | "trending" =
    sortTab === "new" ? "recent" : "trending";

  const loadPosts = useCallback(
    async (reset = false) => {
      try {
        const currentCursor = reset ? null : cursor;
        if (reset) setIsLoading(true);
        else setIsFetchingMore(true);

        const res = await fetchPosts(
          currentCursor,
          20,
          activeCategory || undefined,
          searchQuery || undefined,
          sortMethod,
        );

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
    },
    [cursor, activeCategory, searchQuery, sortMethod],
  );

  useEffect(() => {
    loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, sortTab]);

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPosts(
        null,
        20,
        activeCategory || undefined,
        searchQuery || undefined,
        sortMethod,
      )
        .then((res) => {
          setPosts((prevPosts) => {
            const newPosts = [...prevPosts];
            res.posts.forEach((freshPost) => {
              const index = newPosts.findIndex((p) => p.id === freshPost.id);
              if (index !== -1) {
                newPosts[index] = {
                  ...newPosts[index],
                  likes: freshPost.likes,
                  reply_count: freshPost.reply_count,
                };
              } else if (
                !searchQuery &&
                sortMethod === "recent" &&
                !prevPosts.find((p) => p.id === freshPost.id)
              ) {
                // Prepend new posts if we are sorting by recent and no search query is active
                newPosts.unshift(freshPost);
              }
            });
            // Sort again if trending
            if (sortMethod === "trending") {
              newPosts.sort(
                (a, b) =>
                  b.likes - a.likes ||
                  new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
              );
            } else {
              newPosts.sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              );
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
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const moods = moodsInput
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    try {
      const newPost = await createPost(
        content,
        category,
        isAnonymous,
        tags,
        moods,
      );
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Community{" "}
          <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
            Support
          </span>
        </h1>
        <p className="mt-2 text-text-secondary">
          Share your thoughts anonymously. We&apos;re all in this together.
        </p>
      </div>

      {/* Sort tabs + New entry */}
      <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-full border border-border bg-surface-raised p-1">
          {SORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = sortTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSortTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                  active
                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <Button onClick={() => setIsComposing((c) => !c)}>
          {isComposing ? "Cancel" : "New entry"}
        </Button>
      </div>

      {/* Compose */}
      {isComposing && (
        <div className="animate-in fade-in slide-in-from-top-4 mb-6 rounded-2xl border border-border bg-surface p-4 shadow-md duration-300 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Share your thoughts
          </h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? You can share completely anonymously."
            className="mb-4 min-h-[120px] w-full resize-y rounded-xl border border-border bg-surface p-4 text-sm text-text-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface p-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. mindfulness, help"
                className="w-full rounded-lg border border-border bg-surface p-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Moods (comma separated)
              </label>
              <input
                type="text"
                value={moodsInput}
                onChange={(e) => setMoodsInput(e.target.value)}
                placeholder="e.g. anxious, tired"
                className="w-full rounded-lg border border-border bg-surface p-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-4 w-4 rounded text-brand focus:ring-brand"
              />
              Post Anonymously
            </label>
            <Button
              onClick={handleCreatePost}
              isLoading={isSubmitting}
              disabled={!content.trim()}
            >
              Publish
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search posts..."
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* Category Filter */}
      <div className="scrollbar-hide mb-6 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            activeCategory === null
              ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm"
              : "border border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          }`}
        >
          All Topics
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeCategory === c
                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm"
                : "border border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary"
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
        <div className="rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-border" />
          <h3 className="text-lg font-medium text-text-primary">No posts yet</h3>
          <p className="mt-1 text-text-secondary">
            Be the first to share something with the community.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onCommentClick={setSelectedPost}
              onDelete={(id) => setPosts(posts.filter((p) => p.id !== id))}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pb-12 pt-6">
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
            setPosts(
              posts.map((p) =>
                p.id === selectedPost.id
                  ? { ...p, reply_count: p.reply_count + 1 }
                  : p,
              ),
            );
          }}
        />
      )}
    </div>
  );
}
