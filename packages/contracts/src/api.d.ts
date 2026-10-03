export interface paths {
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Nuxt BFF process 생존 확인 */
        get: operations["getLiveHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Core API, PostgreSQL, migration 준비 확인 */
        get: operations["getReadyHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/boards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 활성 게시판 목록 */
        get: operations["listBoards"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/boards/{boardSlug}/posts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 게시글 목록 */
        get: operations["listPosts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/boards/{boardSlug}/posts/{postId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 게시글 상세와 같은 게시판 context */
        get: operations["getPost"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/boards/{boardSlug}/posts/{postId}/views": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 참고용 조회 수 1 증가 */
        post: operations["incrementPostView"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/policies/{type}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 현재 또는 과거 정책 버전 조회 */
        get: operations["getPolicy"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/posts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 관리자 게시글 검색 */
        get: operations["searchAdminPosts"];
        put?: never;
        /** 초안 생성과 staging 이미지 선점 */
        post: operations["createPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/posts/{postId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 관리자 게시글 편집 상세 */
        get: operations["getPostEditor"];
        put?: never;
        post?: never;
        /** 숨김 검토 글 최종 제거 */
        delete: operations["removePost"];
        options?: never;
        head?: never;
        /** 초안·예약·숨김 검토 글 수정 */
        patch: operations["updatePost"];
        trace?: never;
    };
    "/api/v1/admin/images": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 관리자 staging 이미지 업로드 */
        post: operations["uploadImages"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/images/{imageId}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 인증된 staging 이미지 preview */
        get: operations["previewImage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/images/{imageId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 미연결 staging 이미지 폐기 예약 */
        delete: operations["discardImage"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/posts/{postId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 즉시 발행 또는 예약 발행 */
        post: operations["publishPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/posts/{postId}/unschedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 예약 취소 후 초안 복귀 */
        post: operations["unschedulePost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/posts/{postId}/hide": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 공개 글 숨김 검토 전환 */
        post: operations["hidePost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/posts/{postId}/republish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 숨김 검토 글 재공개 */
        post: operations["republishPost"];
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
        HealthLiveResponse: {
            /** @constant */
            status: "UP";
        };
        HealthReadyResponse: {
            /** @constant */
            status: "READY";
        };
        HealthNotReadyResponse: {
            /** @constant */
            status: "NOT_READY";
        };
        SuccessEnvelope: {
            /** @constant */
            success: true;
            data: Record<string, never>;
            meta: components["schemas"]["ResponseMeta"];
        };
        ErrorEnvelope: {
            /** @constant */
            success: false;
            error: {
                code: components["schemas"]["ErrorCode"];
                message: string;
                fields?: components["schemas"]["FieldError"][];
            };
            meta: components["schemas"]["ResponseMeta"];
        };
        ResponseMeta: {
            requestId: string;
        };
        PaginationMeta: components["schemas"]["ResponseMeta"] & {
            page: number;
            pageSize: number;
            totalItems: number;
            totalPages: number;
            hasPrevious: boolean;
            hasNext: boolean;
        };
        FieldError: {
            field: string;
            reason: string;
        };
        BoardSlug: string;
        BoardSummary: {
            slug: components["schemas"]["BoardSlug"];
            displayName: string;
        };
        BoardListItem: components["schemas"]["BoardSummary"] & {
            /** @constant */
            postingPolicy: "ADMIN";
            path: string;
        };
        BoardListData: {
            items: components["schemas"]["BoardListItem"][];
        };
        PostListData: {
            board: components["schemas"]["BoardSummary"];
            pinnedItems: components["schemas"]["PostListItem"][];
            items: components["schemas"]["PostListItem"][];
        };
        PostListItem: {
            postId: number;
            analyticsContentKey: string;
            title: string;
            viewCount: number;
            authorLabel: string;
            /** Format: date-time */
            publishedAt: string;
            path: string;
            current?: boolean;
        };
        PostDetailData: {
            post: components["schemas"]["PublicPost"];
            context: components["schemas"]["PostContext"];
        };
        PublicPost: {
            postId: number;
            analyticsContentKey: string;
            board: components["schemas"]["BoardSummary"];
            title: string;
            authorLabel: string;
            /** Format: date-time */
            publishedAt: string;
            viewCount: number;
            blocks: components["schemas"]["PublicBlock"][];
            source: components["schemas"]["Source"] | null;
            /** Format: uri */
            shareUrl: string;
        };
        PublicBlock: components["schemas"]["PublicTextBlock"] | components["schemas"]["PublicImageBlock"];
        PublicTextBlock: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "TEXT";
            text: string;
        };
        PublicImageBlock: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "IMAGE";
            image: {
                /** Format: uri */
                url: string;
                alt: string;
                width: number;
                height: number;
            };
        };
        Source: {
            name: string;
            /** Format: uri */
            url: string;
        };
        PostContext: {
            pinnedItems: components["schemas"]["PostListItem"][];
            listPage: number;
            items: components["schemas"]["PostListItem"][];
            /** @constant */
            pageSize: 20;
            totalItems: number;
            totalPages: number;
        };
        PolicyData: {
            policy: components["schemas"]["Policy"];
            history: components["schemas"]["PolicyHistoryItem"][];
        };
        Policy: components["schemas"]["PolicyHistoryItem"] & {
            /** @enum {string} */
            type: "terms" | "privacy";
            title: string;
            /** @description Sanitized HTML. */
            bodyHtml: string;
        };
        PolicyHistoryItem: {
            version: string;
            /** Format: date-time */
            effectiveAt: string;
            endedAt: string | null;
        };
        AdminPostSearchData: {
            items: components["schemas"]["AdminPostSearchItem"][];
        };
        AdminPostSearchItem: {
            postId: number;
            boardSlug: components["schemas"]["BoardSlug"];
            title: string;
            status: components["schemas"]["PostStatus"];
            lockVersion: number;
            scheduledAt: components["schemas"]["NullableDateTime"];
            publishedAt: components["schemas"]["NullableDateTime"];
            /** Format: date-time */
            updatedAt: string;
        };
        AdminPostEditorData: components["schemas"]["AdminPostSearchItem"] & {
            source: components["schemas"]["Source"] | null;
            blocks: components["schemas"]["AdminBlock"][];
            pinnedPosition: components["schemas"]["PinnedPosition"];
            /** Format: date-time */
            createdAt: string;
        };
        AdminBlock: components["schemas"]["AdminTextBlock"] | components["schemas"]["AdminImageBlock"];
        AdminTextBlock: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "TEXT";
            text: string;
        };
        AdminImageBlock: {
            /** @constant */
            type: "IMAGE";
            imageId: number;
            alt: string;
            status: components["schemas"]["ImageStatus"];
            width: number;
            height: number;
            previewPath: string | null;
        } & (unknown & {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "IMAGE";
        });
        CreatePostRequest: {
            boardSlug: components["schemas"]["BoardSlug"];
            title: string;
            source: components["schemas"]["Source"] | null;
            blocks: components["schemas"]["EditBlocks"];
            pinnedPosition: components["schemas"]["PinnedPosition"];
        };
        UpdatePostRequest: {
            lockVersion: number;
            title?: string;
            source?: components["schemas"]["Source"] | null;
            blocks?: components["schemas"]["EditBlocks"];
            pinnedPosition?: components["schemas"]["PinnedPosition"];
        };
        EditBlocks: components["schemas"]["EditBlock"][];
        EditBlock: components["schemas"]["EditTextBlock"] | components["schemas"]["EditImageBlock"];
        EditTextBlock: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "TEXT";
            text: string;
        };
        EditImageBlock: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "IMAGE";
            imageId: number;
            alt: string;
        };
        PublishPostRequest: {
            lockVersion: number;
            /** @enum {string} */
            mode: "IMMEDIATE" | "SCHEDULED";
            /**
             * Format: date-time
             * @description SCHEDULED mode only. Server normalizes the absolute instant to UTC.
             */
            scheduledAt?: string;
        } & unknown;
        HidePostRequest: {
            lockVersion: number;
            /** @enum {string} */
            reasonCode: "RIGHTS_EMAIL" | "EDIT";
        };
        RepublishPostRequest: {
            lockVersion: number;
            pinnedPosition: components["schemas"]["PinnedPosition"];
        };
        RemovePostRequest: {
            lockVersion: number;
            /** @constant */
            reasonCode: "REMOVE";
        };
        LockVersionRequest: {
            lockVersion: number;
        };
        PostCommandResult: {
            postId: number;
            status: components["schemas"]["PostStatus"];
            lockVersion: number;
            /** Format: date-time */
            updatedAt?: string;
        };
        UpdatedPostCommandResult: components["schemas"]["PostCommandResult"] & Record<string, never>;
        PublishPostResult: components["schemas"]["PostCommandResult"] & {
            publishedAt: components["schemas"]["NullableDateTime"];
            scheduledAt: components["schemas"]["NullableDateTime"];
        };
        UnschedulePostResult: components["schemas"]["PostCommandResult"] & {
            scheduledAt: null;
            /** Format: date-time */
            updatedAt: string;
        };
        ImageUploadData: {
            items: components["schemas"]["ImageUploadItem"][];
        };
        ImageUploadItem: {
            imageId: number;
            /** @constant */
            status: "STAGED";
            /** @enum {string} */
            mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
            byteSize: number;
            width: number;
            height: number;
            previewPath: string;
        };
        DiscardImageResult: {
            imageId: number;
            /** @constant */
            status: "PRIVATE_DELETE_PENDING";
        };
        PinnedPosition: number | null;
        NullableDateTime: string | null;
        /** @enum {string} */
        PostStatus: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "HIDDEN_REVIEW" | "REMOVED";
        /** @enum {string} */
        ImageStatus: "STAGED" | "PUBLIC" | "PUBLIC_DELETE_PENDING" | "PRIVATE_REVIEW" | "PRIVATE_DELETE_PENDING" | "DELETED";
        /** @enum {string} */
        ErrorCode: "VALIDATION_FAILED" | "ADMIN_AUTH_REQUIRED" | "ADMIN_FORBIDDEN" | "BOARD_NOT_FOUND" | "POST_NOT_FOUND" | "PAGE_NOT_FOUND" | "POLICY_NOT_FOUND" | "IMAGE_NOT_FOUND" | "POST_STATE_CONFLICT" | "POST_VERSION_CONFLICT" | "PINNED_ORDER_CONFLICT" | "IDEMPOTENCY_CONFLICT" | "IDEMPOTENCY_IN_PROGRESS" | "IMAGE_ALREADY_ATTACHED" | "IMAGE_STATE_CONFLICT" | "RATE_LIMITED" | "UPLOAD_TOO_LARGE" | "REQUEST_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "INTERNAL_ERROR" | "DEPENDENCY_UNAVAILABLE" | "MAINTENANCE_READ_ONLY";
    };
    responses: {
        /** @description Cached body is still valid. */
        NotModified: {
            headers: {
                [name: string]: unknown;
            };
            content?: never;
        };
        /** @description BFF, Core, PostgreSQL, or migration readiness failed. */
        NotReady: {
            headers: {
                "Cache-Control": components["headers"]["NoStore"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["HealthNotReadyResponse"];
            };
        };
        /** @description Request validation failed. */
        ValidationFailed: {
            headers: {
                "Cache-Control": components["headers"]["NoStore"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Board not found or public list page not found. */
        BoardOrPageNotFound: {
            headers: {
                "Cache-Control": components["headers"]["NoStore"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Post not found, hidden, deleted, scheduled, draft, or board mismatch. */
        PostNotFound: {
            headers: {
                "Cache-Control": components["headers"]["NoStore"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Policy type or version does not exist, or is not public. */
        PolicyNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Image does not exist. */
        ImageNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Admin authentication is missing or expired. */
        AdminAuthRequired: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Admin identity is not allowed. */
        AdminForbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Post state, version, image state, pin order, or idempotency conflict. */
        PostConflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Image state conflict. */
        ImageConflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description File count, file size, total size, pixel, or GIF decode limit exceeded. */
        UploadTooLarge: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Unsupported image type or decode validation failed. */
        UnsupportedMediaType: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Request rate limit exceeded. */
        RateLimited: {
            headers: {
                "Retry-After"?: number;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Unclassified server error. */
        InternalError: {
            headers: {
                "Cache-Control": components["headers"]["NoStore"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Database, object storage, or required dependency is unavailable. */
        DependencyUnavailable: {
            headers: {
                "Cache-Control": components["headers"]["NoStore"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description Post command succeeded. */
        PostCommandOk: {
            headers: {
                "Cache-Control": components["headers"]["PrivateNoStore"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["SuccessEnvelope"] & {
                    data: components["schemas"]["UpdatedPostCommandResult"];
                };
            };
        };
    };
    parameters: {
        BoardSlug: components["schemas"]["BoardSlug"];
        PostId: number;
        ImageId: number;
        PolicyType: "terms" | "privacy";
        Page: number;
        /** @description Same actor, method and route pattern retain the key for 24 hours. Replay requires identical path parameters and normalized body; a different target or body returns 409 IDEMPOTENCY_CONFLICT. */
        IdempotencyKey: string;
    };
    requestBodies: never;
    headers: {
        NoStore: "no-store";
        PrivateNoStore: "private, no-store";
        PublicBoardCache: "public, max-age=60, s-maxage=300";
        PublicListCache: "no-store";
        PublicDetailCache: "no-store";
        PublicPolicyCache: "public, max-age=60, s-maxage=300";
        ETag: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getLiveHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Process is alive. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthLiveResponse"];
                };
            };
        };
    };
    getReadyHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dependencies are ready. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthReadyResponse"];
                };
            };
            503: components["responses"]["NotReady"];
        };
    };
    listBoards: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active boards. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PublicBoardCache"];
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["BoardListData"];
                    };
                };
            };
            304: components["responses"]["NotModified"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    listPosts: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
            };
            header?: never;
            path: {
                boardSlug: components["parameters"]["BoardSlug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Public post page. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PublicListCache"];
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["PostListData"];
                        meta: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            304: components["responses"]["NotModified"];
            400: components["responses"]["ValidationFailed"];
            404: components["responses"]["BoardOrPageNotFound"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    getPost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                boardSlug: components["parameters"]["BoardSlug"];
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Public post detail. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PublicDetailCache"];
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["PostDetailData"];
                    };
                };
            };
            304: components["responses"]["NotModified"];
            404: components["responses"]["PostNotFound"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    incrementPostView: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                boardSlug: components["parameters"]["BoardSlug"];
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description View count incremented. Response body is empty. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ValidationFailed"];
            404: components["responses"]["PostNotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    getPolicy: {
        parameters: {
            query?: {
                version?: string;
            };
            header?: never;
            path: {
                type: components["parameters"]["PolicyType"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Policy version and public history. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PublicPolicyCache"];
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["PolicyData"];
                    };
                };
            };
            304: components["responses"]["NotModified"];
            404: components["responses"]["PolicyNotFound"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    searchAdminPosts: {
        parameters: {
            query?: {
                status?: components["schemas"]["PostStatus"];
                board?: components["schemas"]["BoardSlug"];
                titlePrefix?: string;
                from?: string;
                to?: string;
                page?: components["parameters"]["Page"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Admin post search result. Valid over-page requests return empty items. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["AdminPostSearchData"];
                        meta: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    createPost: {
        parameters: {
            query?: never;
            header: {
                /** @description Same actor, method and route pattern retain the key for 24 hours. Replay requires identical path parameters and normalized body; a different target or body returns 409 IDEMPOTENCY_CONFLICT. */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePostRequest"];
            };
        };
        responses: {
            /** @description Draft created. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["PostCommandResult"];
                    };
                };
            };
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            /** @description BOARD_NOT_FOUND — active target board does not exist. */
            404: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            409: components["responses"]["PostConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    getPostEditor: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Editable post projection. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["AdminPostEditorData"];
                    };
                };
            };
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["PostNotFound"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    removePost: {
        parameters: {
            query?: never;
            header: {
                /** @description Same actor, method and route pattern retain the key for 24 hours. Replay requires identical path parameters and normalized body; a different target or body returns 409 IDEMPOTENCY_CONFLICT. */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RemovePostRequest"];
            };
        };
        responses: {
            200: components["responses"]["PostCommandOk"];
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["PostNotFound"];
            409: components["responses"]["PostConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    updatePost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePostRequest"];
            };
        };
        responses: {
            200: components["responses"]["PostCommandOk"];
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["PostNotFound"];
            409: components["responses"]["PostConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    uploadImages: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    files: string[];
                };
            };
        };
        responses: {
            /** @description All files validated and staged. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["ImageUploadData"];
                    };
                };
            };
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            413: components["responses"]["UploadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    previewImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                imageId: components["parameters"]["ImageId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Image bytes. Storage key and signed URL are not exposed. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "image/webp": string;
                    "image/gif": string;
                };
            };
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["ImageNotFound"];
            409: components["responses"]["ImageConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    discardImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                imageId: components["parameters"]["ImageId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Private object deletion scheduled. */
            202: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["DiscardImageResult"];
                    };
                };
            };
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["ImageNotFound"];
            409: components["responses"]["ImageConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    publishPost: {
        parameters: {
            query?: never;
            header: {
                /** @description Same actor, method and route pattern retain the key for 24 hours. Replay requires identical path parameters and normalized body; a different target or body returns 409 IDEMPOTENCY_CONFLICT. */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishPostRequest"];
            };
        };
        responses: {
            /** @description Post published or scheduled. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["PublishPostResult"];
                    };
                };
            };
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["PostNotFound"];
            409: components["responses"]["PostConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    unschedulePost: {
        parameters: {
            query?: never;
            header: {
                /** @description Same actor, method and route pattern retain the key for 24 hours. Replay requires identical path parameters and normalized body; a different target or body returns 409 IDEMPOTENCY_CONFLICT. */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LockVersionRequest"];
            };
        };
        responses: {
            /** @description Post returned to draft. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PrivateNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessEnvelope"] & {
                        data: components["schemas"]["UnschedulePostResult"];
                    };
                };
            };
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["PostNotFound"];
            409: components["responses"]["PostConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    hidePost: {
        parameters: {
            query?: never;
            header: {
                /** @description Same actor, method and route pattern retain the key for 24 hours. Replay requires identical path parameters and normalized body; a different target or body returns 409 IDEMPOTENCY_CONFLICT. */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HidePostRequest"];
            };
        };
        responses: {
            200: components["responses"]["PostCommandOk"];
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["PostNotFound"];
            409: components["responses"]["PostConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
    republishPost: {
        parameters: {
            query?: never;
            header: {
                /** @description Same actor, method and route pattern retain the key for 24 hours. Replay requires identical path parameters and normalized body; a different target or body returns 409 IDEMPOTENCY_CONFLICT. */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                postId: components["parameters"]["PostId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RepublishPostRequest"];
            };
        };
        responses: {
            200: components["responses"]["PostCommandOk"];
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["AdminAuthRequired"];
            403: components["responses"]["AdminForbidden"];
            404: components["responses"]["PostNotFound"];
            409: components["responses"]["PostConflict"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["DependencyUnavailable"];
        };
    };
}
