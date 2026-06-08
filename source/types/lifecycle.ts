export interface OnMountInterface {
    onMount(): void | Promise<void>;
}

export interface OnUnmountInterface {
    onUnmount(): void | Promise<void>;
}

export interface OnInitInterface {
    onInit(): void | Promise<void>;
}
