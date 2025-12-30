import {FileSizeFormated} from "../types";

export function parseBytes(bytes: number, decimals = 2): FileSizeFormated {
    if (bytes === 0) return {size: 0, unit: "o"};

    const k = 1024;
    const units = ["o", "Ko", "Mo", "Go", "To"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
    return {size, unit: units[i]}
}

export function formatBytes(bytes: number, decimals = 2): string {
    const {size, unit} = parseBytes(bytes, decimals);
    return `${size.toString().trim()}${unit.trim()}`;
}