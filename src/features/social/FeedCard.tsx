import { MessageCircle } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { CoverImage } from '@/components/media/CoverImage';
import { Avatar } from '@/features/friends/Avatar';
import type { ReactionState } from '@/features/social/useActivityReactions';
import { activityVerb, REACTIONS, relativeTime, type ReactionKind } from '@/lib/socialFeed';
import { COLORS } from '@/theme/colors';
import type { BookActivityEvent, Profile } from '@/types/book';

type FeedCardProps = {
  event: BookActivityEvent;
  actor: Profile | undefined;
  coverUrl: string | null;
  /** Rows newer than your last visit wear a dot. */
  fresh?: boolean;
  reactions: ReactionState;
  /** How many comments the thread holds, for the badge. */
  commentCount: number;
  onToggleReaction: (kind: ReactionKind) => void;
  onOpenBook: () => void;
  onOpenProfile: () => void;
  onOpenThread: () => void;
};

/**
 * One row of the feed: who, what they did, to which book, when.
 *
 * The cover comes from the caller, not the event: an activity row stores only
 * the title (it has to survive the book being deleted), so the feed looks the
 * jacket up by book key where it can and renders the fallback where it cannot.
 */
export function FeedCard({
  event,
  actor,
  coverUrl,
  fresh,
  reactions,
  commentCount,
  onToggleReaction,
  onOpenBook,
  onOpenProfile,
  onOpenThread,
}: FeedCardProps) {
  const name = actor?.displayName || actor?.username || 'Someone';

  return (
    <View className="gap-3 rounded-2xl border border-border bg-card/50 p-3">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={onOpenProfile} hitSlop={6} className="active:opacity-70">
          <Avatar profile={actor ?? null} size={36} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm text-foreground">
            <Text className="font-bold">{name}</Text> <Text className="text-muted-foreground">{activityVerb(event)}</Text>
          </Text>
          <Text className="text-[11px] text-muted-foreground">{relativeTime(event.createdAt)}</Text>
        </View>
        {fresh && <View className="h-2 w-2 rounded-full bg-primary" />}
      </View>

      <Pressable onPress={onOpenBook} className="flex-row items-center gap-3 active:opacity-80">
        <View className="h-14 w-14 overflow-hidden rounded-md bg-secondary">
          <CoverImage uri={coverUrl} iconSize={18} />
        </View>
        <Text numberOfLines={2} className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          {event.bookTitle}
        </Text>
      </Pressable>

      <View className="flex-row items-center gap-2">
        {REACTIONS.map((reaction) => {
          const count = reactions.counts[reaction.kind];
          const mine = reactions.mine.has(reaction.kind);
          return (
            <Pressable
              key={reaction.kind}
              onPress={() => onToggleReaction(reaction.kind)}
              accessibilityLabel={`React with ${reaction.label}`}
              className="min-h-[32px] flex-row items-center gap-1.5 rounded-full border px-2.5"
              style={{
                borderColor: mine ? COLORS.accent : 'transparent',
                backgroundColor: mine ? COLORS.accentSoft : 'rgba(255,255,255,0.05)',
              }}
            >
              <Text className="text-sm">{reaction.emoji}</Text>
              {count > 0 && (
                <Text className={mine ? 'text-xs font-bold text-primary' : 'text-xs text-muted-foreground'}>{count}</Text>
              )}
            </Pressable>
          );
        })}

        <View className="flex-1" />

        <Pressable
          onPress={onOpenThread}
          accessibilityLabel={commentCount > 0 ? `${commentCount} comments` : 'Comment'}
          className="min-h-[32px] flex-row items-center gap-1.5 rounded-full px-2.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          <MessageCircle size={14} color={COLORS.muted} />
          {commentCount > 0 && <Text className="text-xs text-muted-foreground">{commentCount}</Text>}
        </Pressable>
      </View>
    </View>
  );
}
