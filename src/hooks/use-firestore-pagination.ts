import { useState, useCallback, useEffect, useRef } from 'react';
import {
    query,
    limit,
    startAfter,
    getDocs,
    DocumentData,
    Query,
    QueryConstraint,
    QueryDocumentSnapshot,
    FirestoreError
} from 'firebase/firestore';

interface UseFirestorePaginationResult<T> {
    data: T[];
    loading: boolean;
    error: FirestoreError | null;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    reload: () => Promise<void>;
    updateItem: (id: string, partialData: Partial<T>) => void;
}

export function useFirestorePagination<T = DocumentData>(
    baseQuery: Query<DocumentData>,
    pageSize: number = 20,
    constraints: QueryConstraint[] = []
): UseFirestorePaginationResult<T & { id: string }> {
    const [data, setData] = useState<(T & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<FirestoreError | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
    const isFetchingRef = useRef(false);

    // Reset function to clear state and reload
    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        setData([]);
        setHasMore(true);
        lastDocRef.current = null;
        isFetchingRef.current = true;

        try {
            // Apply constraints and limit
            console.log("useFirestorePagination: Fetching with pageSize:", pageSize);
            const firstQuery = query(baseQuery, ...constraints, limit(pageSize));
            const snapshot = await getDocs(firstQuery);
            console.log("useFirestorePagination: Fetched docs count:", snapshot.docs.length);

            if (snapshot.docs.length < pageSize) {
                console.log("useFirestorePagination: Less docs than pageSize. Has more? False.");
            }

            const newItems = snapshot.docs.map(doc => ({
                ...(doc.data() as T),
                id: doc.id
            }));

            setData(newItems);
            lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
            setHasMore(snapshot.docs.length === pageSize);
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError(err);
        } finally {
            if (isFetchingRef.current) {
                setLoading(false);
                isFetchingRef.current = false;
            }
        }
    }, [baseQuery, pageSize, JSON.stringify(constraints)]); // Ensure constraints changes trigger reload

    // Load more function
    const loadMore = useCallback(async () => {
        if (!hasMore || isFetchingRef.current || !lastDocRef.current) return;

        isFetchingRef.current = true;
        // Don't set global loading to true to avoid UI flickering, just fetch in background
        // or you could add a 'fetchingMore' state if needed.

        try {
            const nextQuery = query(
                baseQuery,
                ...constraints,
                startAfter(lastDocRef.current),
                limit(pageSize)
            );

            const snapshot = await getDocs(nextQuery);

            if (snapshot.empty) {
                setHasMore(false);
                isFetchingRef.current = false;
                return;
            }

            const newItems = snapshot.docs.map(doc => ({
                ...(doc.data() as T),
                id: doc.id
            }));

            setData(prev => [...prev, ...newItems]);
            lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
            setHasMore(snapshot.docs.length === pageSize);
        } catch (err: any) {
            console.error("Error fetching more data:", err);
            setError(err);
        } finally {
            isFetchingRef.current = false;
        }
    }, [baseQuery, constraints, hasMore, pageSize]);

    // Initial load
    useEffect(() => {
        reload();
    }, [reload]);

    // Manual update function
    const updateItem = useCallback((id: string, partialData: Partial<T>) => {
        setData(prev => prev.map(item =>
            item.id === id ? { ...item, ...partialData } : item
        ));
    }, []);

    return { data, loading, error, hasMore, loadMore, reload, updateItem };
}
