import { Search } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { SearchInput } from '@/components/ui/SearchInput';
import { useIsDesktop } from '@/hooks/useResponsive';
import { useSearchFocusRegistration } from '@/hooks/useSearchFocusRegistration';
import { COLORS } from '@/theme/colors';

type BrowseSearchBarProps = {
  value: string;
  onChange: (text: string) => void;
  loading: boolean;
};

/**
 * Browse's search field. It registers itself as the screen's focus target, so
 * the nav bar's left island on this tab — and `/` on desktop web — lands here.
 *
 * This is the honest primary affordance of the tab: Google Books has no chart
 * to browse, so typing a title is the thing that actually works, and the
 * discovery rows below it are the extra.
 */
export function BrowseSearchBar({ value, onChange, loading }: BrowseSearchBarProps) {
  const isDesktop = useIsDesktop();
  const searchRef = useSearchFocusRegistration();

  return (
    <View className={isDesktop ? 'px-8 pb-4 pt-2' : 'px-4 pb-3 pt-1'}>
      <View className="relative">
        <View className="absolute bottom-0 left-3 top-0 z-10 justify-center">
          <Search size={18} color={COLORS.muted} />
        </View>
        <SearchInput
          ref={searchRef}
          value={value}
          onChangeText={onChange}
          placeholder={isDesktop ? 'Search any book — title, author or ISBN    /' : 'Search any book — title, author or ISBN'}
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          autoCorrect={false}
          className="h-11 w-full rounded-lg border border-border bg-secondary pl-10 pr-10 text-foreground"
        />
        {loading && (
          <View className="absolute bottom-0 right-3 top-0 justify-center">
            <ActivityIndicator size="small" color={COLORS.muted} />
          </View>
        )}
      </View>
    </View>
  );
}
