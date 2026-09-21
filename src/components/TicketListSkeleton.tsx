import React from "react";
import { ViewStyle } from "react-native";
import { LayoutLoader } from "./LayoutLoader";
import { TicketCardSkeleton } from "./TicketCardSkeleton";

interface TicketListSkeletonProps {
  count?: number;
  style?: ViewStyle | ViewStyle[];
}

/** Layout loader for ticket list screens (incidents/requests/complaints/queries). */
export const TicketListSkeleton: React.FC<TicketListSkeletonProps> = ({
  count = 6,
  style,
}) => (
  <LayoutLoader scrollable style={style}>
    {Array.from({ length: count }).map((_, i) => (
      <TicketCardSkeleton key={i} />
    ))}
  </LayoutLoader>
);
