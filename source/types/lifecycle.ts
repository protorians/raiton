export interface OnMount {
    onMount(): void | Promise<void>;
}

export interface OnUnmount {
    onUnmount(): void | Promise<void>;
}

export interface OnInit {
    onInit(): void | Promise<void>;
}
