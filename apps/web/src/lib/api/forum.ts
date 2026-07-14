import { apiFetch } from "./client";

export interface PostResponse {
  id: string;
  content: string;
  author_id: string | null;
  org_id: string;
  likes: number;
  reply_count: number;
  category: string;
  is_anonymous: boolean;
  tags: string[];
  moods: string[];
  is_mine: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentResponse {
  id: string;
  post_id: string;
  author_id: string | null;
  parent_id: string | null;
  content: string;
  is_anonymous: boolean;
  created_at: string;
}

export async function fetchPosts(
  cursor?: string | null,
  limit: number = 20,
  category?: string,
  search?: string,
  sort: string = "recent"
): Promise<{ posts: PostResponse[]; next_cursor: string | null }> {
  const params = new URLSearchParams({ limit: limit.toString(), sort });
  if (cursor) params.append("cursor", cursor);
  if (category) params.append("category", category);
  if (search) params.append("search", search);

  const res = await apiFetch(`/forum/posts?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

export async function createPost(
  content: string,
  category: string,
  is_anonymous: boolean,
  tags: string[] = [],
  moods: string[] = []
): Promise<PostResponse> {
  const res = await apiFetch("/forum/posts", {
    method: "POST",
    body: JSON.stringify({ content, category, is_anonymous, tags, moods }),
  });
  if (!res.ok) throw new Error("Failed to create post");
  return res.json();
}

export async function toggleLike(
  postId: string
): Promise<{ status: "liked" | "unliked"; likes: number }> {
  const res = await apiFetch(`/forum/posts/${postId}/like`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to toggle like");
  return res.json();
}

export async function fetchComments(postId: string): Promise<CommentResponse[]> {
  const res = await apiFetch(`/forum/posts/${postId}/comments`);
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}

export async function createComment(
  postId: string,
  content: string,
  is_anonymous: boolean,
  parent_id?: string
): Promise<CommentResponse> {
  const res = await apiFetch(`/forum/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, is_anonymous, parent_id }),
  });
  if (!res.ok) throw new Error("Failed to create comment");
  return res.json();
}

export async function reportContent(
  target_type: "post" | "comment",
  target_id: string,
  reason: string
): Promise<void> {
  const res = await apiFetch("/forum/reports", {
    method: "POST",
    body: JSON.stringify({ target_type, target_id, reason }),
  });
  if (!res.ok) throw new Error("Failed to report content");
}

export async function deletePost(postId: string): Promise<void> {
  const res = await apiFetch(`/forum/posts/${postId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete post");
}
