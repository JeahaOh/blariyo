export interface paths {
    "/api/v1/admin/collect/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listCollectionSources"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/collect/sources/{sourceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["updateCollectionSource"];
        trace?: never;
    };
    "/api/v1/admin/collect/candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listCollectionCandidates"];
        put?: never;
        post: operations["createCollectionCandidate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/collect/candidates/{candidateId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getCollectionCandidate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/collect/candidates/{candidateId}/images/{candidateImageId}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["previewCollectionImage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/collect/candidates/{candidateId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["retryCollectionCandidate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/collect/candidates/{candidateId}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["rejectCollectionCandidate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/collect/candidates/{candidateId}/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["promoteCollectionCandidate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["collectorCreateCandidate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/candidates/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["collectorClaim"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/candidates/{candidateId}/heartbeat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["collectorHeartbeat"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/candidates/{candidateId}/result": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["collectorResult"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/candidates/{candidateId}/images/{candidateImageId}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["collectorUploadPreview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["collectorStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/candidates/{candidateId}/execution-state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["collectorExecutionState"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/sources/{sourceId}/request-reservations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["collectorReservation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/collector/v1/operational-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["collectorOperationalEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/collect/operational-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listCollectorOperationalEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/collect/operational-events/{eventId}/acknowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["acknowledgeCollectorOperationalEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        CollectionSource: {
            sourceId: number;
            lockVersion: number;
            name: string;
            /** Format: uri */
            baseUrl: string;
            host: string;
            /** @enum {string} */
            fetchMode: "URL_ONLY";
            /** @enum {string} */
            parserType: "MANUAL";
            listUrl: null;
            isActive: boolean;
            /** @constant */
            isListCrawlEnabled: false;
            robotsAllowed: boolean | null;
            robotsCheckedAt: string | null;
            requestIntervalMs: number;
            dailyFetchLimit: number;
            lastFetchedAt: string | null;
            lastErrorCode: string | null;
            disabledReasonCode: string | null;
            /** Format: date-time */
            updatedAt: string;
        };
        CollectionCandidate: {
            candidateId: number;
            sourceId: number;
            sourceName: string;
            /** Format: uri */
            originUrl: string;
            title: string | null;
            /** @enum {string} */
            status: "PENDING" | "RUNNING" | "NEW" | "FETCH_FAILED" | "APPROVED" | "REJECTED";
            /** @enum {string} */
            discoveryMode: "MANUAL_URL" | "LIST_CRAWL";
            imageCandidateCount: number;
            duplicatePostId: number | null;
            postId: number | null;
            rejectReasonCode: string | null;
            fetchErrorCode: string | null;
            /** Format: date-time */
            requestedAt: string;
            claimedAt: string | null;
            fetchedAt: string | null;
            lockVersion: number;
        };
        CollectionCandidateImage: {
            candidateImageId: number;
            position: number;
            /** Format: uri */
            remoteUrl: string;
            /** @enum {string} */
            status: "DISCOVERED" | "STORED" | "SKIPPED" | "FAILED";
            imageId: number | null;
            previewPath: string | null;
            previewExpiresAt: string | null;
            fetchErrorCode: string | null;
        };
        CollectionContentBlock: {
            /** @constant */
            type: "TEXT";
            text: string;
        } | {
            /** @constant */
            type: "IMAGE";
            imagePosition: number;
            alt: string;
        } | {
            /** @constant */
            type: "LINK";
            /** Format: uri */
            url: string;
            label: string;
        };
        CollectionContentBlocks: components["schemas"]["CollectionContentBlock"][];
    };
    responses: {
        /** @description Generalized failure */
        CollectionFailure: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    /** @constant */
                    success: false;
                    error: {
                        code: string;
                        message: string;
                        fields?: {
                            field: string;
                            reason: string;
                        }[];
                    };
                    meta: {
                        requestId: string;
                    };
                };
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listCollectionSources: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            items: components["schemas"]["CollectionSource"][];
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    updateCollectionSource: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    lockVersion: number;
                    isActive?: boolean;
                    /** @enum {string} */
                    fetchMode?: "URL_ONLY" | "LIST_CRAWL";
                    listUrl?: string | null;
                    /** @enum {string} */
                    parserType?: "MANUAL" | "HTML_LIST" | "RSS";
                    isListCrawlEnabled?: boolean;
                    robotsAllowed?: boolean | null;
                    requestIntervalMs?: number;
                    dailyFetchLimit?: number;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: components["schemas"]["CollectionSource"];
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    listCollectionCandidates: {
        parameters: {
            query?: {
                status?: "PENDING" | "RUNNING" | "NEW" | "FETCH_FAILED" | "APPROVED" | "REJECTED";
                sourceId?: number;
                discoveryMode?: "MANUAL_URL" | "LIST_CRAWL";
                duplicateOnly?: "true" | "false";
                page?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            items: components["schemas"]["CollectionCandidate"][];
                        };
                        meta: {
                            requestId: string;
                            page: number;
                            /** @constant */
                            pageSize: 50;
                            totalItems: number;
                            totalPages: number;
                            hasPrevious: boolean;
                            hasNext: boolean;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    createCollectionCandidate: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uri */
                    originUrl: string;
                };
            };
        };
        responses: {
            /** @description Success */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateId: number;
                            /** @enum {string} */
                            status: "PENDING" | "RUNNING" | "NEW" | "FETCH_FAILED" | "APPROVED" | "REJECTED";
                            lockVersion: number;
                            duplicatePostId?: number | null;
                            reviewedAt?: string | null;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    getCollectionCandidate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                candidateId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateId: number;
                            sourceId: number;
                            sourceName: string;
                            /** Format: uri */
                            originUrl: string;
                            title: string | null;
                            /** @enum {string} */
                            status: "PENDING" | "RUNNING" | "NEW" | "FETCH_FAILED" | "APPROVED" | "REJECTED";
                            /** @enum {string} */
                            discoveryMode: "MANUAL_URL" | "LIST_CRAWL";
                            imageCandidateCount: number;
                            duplicatePostId: number | null;
                            postId: number | null;
                            rejectReasonCode: string | null;
                            fetchErrorCode: string | null;
                            /** Format: date-time */
                            requestedAt: string;
                            claimedAt: string | null;
                            fetchedAt: string | null;
                            lockVersion: number;
                            imageCandidates: components["schemas"]["CollectionCandidateImage"][];
                            warnings: string[];
                            contentBlocks?: components["schemas"]["CollectionContentBlocks"] | null;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    previewCollectionImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                candidateId: number;
                candidateImageId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authenticated temporary image */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    retryCollectionCandidate: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                candidateId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    lockVersion: number;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateId: number;
                            /** @enum {string} */
                            status: "PENDING" | "RUNNING" | "NEW" | "FETCH_FAILED" | "APPROVED" | "REJECTED";
                            lockVersion: number;
                            duplicatePostId?: number | null;
                            reviewedAt?: string | null;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    rejectCollectionCandidate: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                candidateId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    lockVersion: number;
                    /** @enum {string} */
                    reasonCode: "DUPLICATE" | "LOW_QUALITY" | "RIGHTS_RISK" | "NOT_FUNNY" | "SOURCE_GONE" | "OTHER";
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateId: number;
                            /** @enum {string} */
                            status: "PENDING" | "RUNNING" | "NEW" | "FETCH_FAILED" | "APPROVED" | "REJECTED";
                            lockVersion: number;
                            duplicatePostId?: number | null;
                            reviewedAt?: string | null;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    promoteCollectionCandidate: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                candidateId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    lockVersion: number;
                    boardSlug: string;
                    title?: string;
                    source?: {
                        name: string;
                        /** Format: uri */
                        url: string;
                    };
                    candidateImageIds: number[];
                    imageOptions: {
                        candidateImageId: number;
                        alt: string;
                        uploadedImageId?: number;
                    }[];
                    leadText?: string;
                    acknowledgeDuplicate: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            postId: number;
                            /** @constant */
                            status: "DRAFT";
                            /** @constant */
                            lockVersion: 1;
                            candidateId: number;
                            storedImageIds: number[];
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorCreateCandidate: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    collectorId: string;
                    /** Format: uri */
                    originUrl: string;
                    /** @enum {string} */
                    discoveryMode?: "MANUAL_URL" | "LIST_CRAWL";
                };
            };
        };
        responses: {
            /** @description Success */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateId: number;
                            /** @enum {string} */
                            status: "PENDING" | "RUNNING" | "NEW" | "FETCH_FAILED" | "APPROVED" | "REJECTED";
                            lockVersion: number;
                            duplicatePostId?: number | null;
                            reviewedAt?: string | null;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorClaim: {
        parameters: {
            query?: never;
            header?: {
                /** @description SPRING_V2 credentials require this header. Optional only for LEGACY_V1. */
                "Idempotency-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    collectorId: string;
                    maxItems: number;
                    leaseSeconds: number;
                    candidateId?: number;
                } | ({
                    collectorId: string;
                    /** @constant */
                    maxItems: 1;
                    leaseSeconds: number;
                    candidateId?: number;
                    /** Format: uuid */
                    collectorExecutionId: string;
                    /** Format: uuid */
                    jobRequestId: string;
                    /** @enum {unknown} */
                    mode: "COLLECT" | "PREVIEW_REFRESH";
                    lockVersion?: number;
                } & unknown);
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            items: ({
                                candidateId: number;
                                sourceId: number;
                                sourceHost: string;
                                /** Format: uri */
                                originUrl: string;
                                /** @enum {string} */
                                discoveryMode: "MANUAL_URL" | "LIST_CRAWL";
                                attemptCount: number;
                                lockVersion: number;
                                /** Format: date-time */
                                leaseUntil: string;
                                requestIntervalMs: number;
                                dailyFetchLimit: number;
                                robotsAllowed: boolean | null;
                                robotsCheckedAt: string | null;
                                isActive: boolean;
                            } | {
                                candidateId: number;
                                sourceId: number;
                                sourceHost: string;
                                /** Format: uri */
                                originUrl: string;
                                /** @enum {string} */
                                discoveryMode: "MANUAL_URL" | "LIST_CRAWL";
                                attemptCount: number;
                                lockVersion: number;
                                /** Format: date-time */
                                leaseUntil: string;
                                requestIntervalMs: number;
                                dailyFetchLimit: number;
                                robotsAllowed: boolean | null;
                                robotsCheckedAt: string | null;
                                isActive: boolean;
                                /** Format: uuid */
                                collectorExecutionId: string;
                            } | {
                                candidateId: number;
                                sourceId: number;
                                sourceHost: string;
                                /** @enum {string} */
                                discoveryMode: "MANUAL_URL" | "LIST_CRAWL";
                                attemptCount: number;
                                lockVersion: number;
                                leaseUntil: null;
                                requestIntervalMs: number;
                                dailyFetchLimit: number;
                                robotsAllowed: boolean | null;
                                robotsCheckedAt: string | null;
                                isActive: boolean;
                                /** Format: uuid */
                                collectorExecutionId: string;
                                images: {
                                    candidateImageId: number;
                                    position: number;
                                    /** Format: uri */
                                    remoteUrl: string;
                                }[];
                            })[];
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorHeartbeat: {
        parameters: {
            query?: never;
            header?: {
                /** @description SPRING_V2 credentials require this header. Optional only for LEGACY_V1. */
                "Idempotency-Key"?: string;
            };
            path: {
                candidateId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    collectorId: string;
                    leaseSeconds: number;
                    lockVersion: number;
                } | {
                    collectorId: string;
                    leaseSeconds: number;
                    lockVersion: number;
                    /** Format: uuid */
                    collectorExecutionId: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateId: number;
                            /** @constant */
                            status: "RUNNING";
                            lockVersion: number;
                            /** Format: date-time */
                            leaseUntil: string;
                            source: components["schemas"]["CollectionSource"] | {
                                sourceId: number;
                                host: string;
                                lockVersion: number;
                                isActive: boolean;
                                robotsAllowed: boolean | null;
                                robotsCheckedAt: string | null;
                                requestIntervalMs: number;
                                dailyFetchLimit: number;
                            };
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorResult: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                candidateId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    collectorId: string;
                    lockVersion: number;
                    /** @constant */
                    status: "NEW";
                    title: string;
                    /** Format: uri */
                    canonicalUrl: string;
                    sourcePublishedAt: string | null;
                    parserVersion: string;
                    warnings: string[];
                    imageCandidates: {
                        position: number;
                        /** Format: uri */
                        remoteUrl: string;
                    }[];
                    contentBlocks?: components["schemas"]["CollectionContentBlocks"];
                } | {
                    collectorId: string;
                    lockVersion: number;
                    /** @constant */
                    status: "FETCH_FAILED";
                    fetchErrorCode: string;
                    warnings: string[];
                } | {
                    collectorId: string;
                    lockVersion: number;
                    /** @constant */
                    status: "NEW";
                    title: string;
                    /** Format: uri */
                    canonicalUrl: string;
                    sourcePublishedAt: string | null;
                    parserVersion: string;
                    warnings: string[];
                    imageCandidates: {
                        position: number;
                        /** Format: uri */
                        remoteUrl: string;
                    }[];
                    /** Format: uuid */
                    collectorExecutionId: string;
                    contentBlocks?: components["schemas"]["CollectionContentBlocks"];
                } | {
                    collectorId: string;
                    lockVersion: number;
                    /** @constant */
                    status: "FETCH_FAILED";
                    fetchErrorCode: string;
                    warnings: string[];
                    /** Format: uuid */
                    collectorExecutionId: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateId: number;
                            /** @enum {string} */
                            status: "NEW" | "FETCH_FAILED";
                            lockVersion: number;
                            imageCandidates: {
                                position: number;
                                candidateImageId: number;
                            }[];
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorUploadPreview: {
        parameters: {
            query?: never;
            header?: {
                /** @description SPRING_V2 credentials require this header. Optional only for LEGACY_V1. */
                "Idempotency-Key"?: string;
                /** @description Required for SPRING_V2; hash of the original file bytes. */
                "X-Content-SHA256"?: string;
            };
            path: {
                candidateId: number;
                candidateImageId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    collectorId: string;
                    lockVersion: number;
                    /** Format: binary */
                    file: string;
                } | {
                    collectorId: string;
                    lockVersion: number;
                    /** Format: binary */
                    file: string;
                    /** Format: uuid */
                    collectorExecutionId: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateImageId: number;
                            previewPath: string;
                            /** Format: date-time */
                            previewExpiresAt: string;
                            lockVersion: number;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorStatus: {
        parameters: {
            query?: {
                windowHours?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            /** Format: date-time */
                            asOf: string;
                            windowHours: number;
                            candidateCounts: {
                                pending: number;
                                running: number;
                                new: number;
                                fetchFailed: number;
                            };
                            disabledSourceCount: number;
                            recentErrorCounts: {
                                code: string;
                                count: number;
                            }[];
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorExecutionState: {
        parameters: {
            query: {
                collectorExecutionId: string;
            };
            header?: never;
            path: {
                candidateId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            candidateId: number;
                            /** @enum {unknown} */
                            status: "PENDING" | "RUNNING" | "NEW" | "FETCH_FAILED";
                            /** Format: uuid */
                            collectorExecutionId: string;
                            lockVersion: number;
                            leaseUntil: string | null;
                            attemptCount: number;
                            resultPayloadSha256: string | null;
                            images: {
                                candidateImageId: number;
                                position: number;
                                previewSourceSha256: string | null;
                                previewPath: string | null;
                                previewExpiresAt: string | null;
                            }[];
                        } | {
                            candidateId: number;
                            /** @enum {unknown} */
                            status: "APPROVED" | "REJECTED";
                            /** @constant */
                            terminal: true;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorReservation: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                sourceId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    collectorId: string;
                    /** Format: uuid */
                    jobRequestId: string;
                    /** Format: uuid */
                    collectorExecutionId: string;
                    candidateId?: number;
                    lockVersion?: number;
                    requestKey: string;
                    /** @enum {unknown} */
                    requestKind: "ROBOTS" | "DETAIL" | "REDIRECT" | "IMAGE" | "LIST";
                    discovery?: boolean;
                } & unknown;
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            /** Format: uuid */
                            reservationId: string;
                            /** Format: date */
                            budgetDate: string;
                            reservedCount: number;
                            remainingCount: number;
                            /** Format: date-time */
                            serverNow: string;
                            /** Format: date-time */
                            validUntil: string;
                            /** Format: date-time */
                            nextAllowedAt: string;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    collectorOperationalEvent: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    collectorId: string;
                    jobRequestId?: string | null;
                    candidateId?: number | null;
                    /** Format: uuid */
                    deliveryId: string;
                    /** @enum {unknown} */
                    eventCode: "NOTIFICATION_FINAL_FAILED" | "RECONCILE_REQUIRED" | "SPOOL_CLEANUP_FAILED" | "LEASE_EXPIRED" | "QUOTA_INTERVAL_VIOLATION" | "COLLECTOR_CLOCK_UNSAFE";
                    /** @enum {unknown} */
                    severity: "INFO" | "WARN" | "ERROR";
                    /** Format: date-time */
                    occurredAt: string;
                    attemptCount: number;
                };
            };
        };
        responses: {
            /** @description Success */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            /** Format: uuid */
                            eventId: string;
                            /** Format: date-time */
                            acceptedAt: string;
                            deduplicated: boolean;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    listCollectorOperationalEvents: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            items: {
                                /** Format: uuid */
                                eventId: string;
                                candidateId: number | null;
                                eventCode: string;
                                /** @enum {unknown} */
                                severity: "INFO" | "WARN" | "ERROR";
                                /** Format: date-time */
                                occurredAt: string;
                                /** @enum {unknown} */
                                deliveryStatus: "UNACKNOWLEDGED" | "ACKNOWLEDGED";
                            }[];
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
    acknowledgeCollectorOperationalEvent: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        success: true;
                        data: {
                            /** Format: uuid */
                            eventId: string;
                            /** @constant */
                            deliveryStatus: "ACKNOWLEDGED";
                            /** Format: date-time */
                            acknowledgedAt: string;
                        };
                        meta: {
                            requestId: string;
                        };
                    };
                };
            };
            400: components["responses"]["CollectionFailure"];
            401: components["responses"]["CollectionFailure"];
            403: components["responses"]["CollectionFailure"];
            404: components["responses"]["CollectionFailure"];
            409: components["responses"]["CollectionFailure"];
            413: components["responses"]["CollectionFailure"];
            415: components["responses"]["CollectionFailure"];
            429: components["responses"]["CollectionFailure"];
            500: components["responses"]["CollectionFailure"];
            503: components["responses"]["CollectionFailure"];
        };
    };
}
