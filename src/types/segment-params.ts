export type SegmentParams<T> = {
    params: Promise<T>;
}

export type IdSegmentParams = SegmentParams<{
    id: string
}>;
