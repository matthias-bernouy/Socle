import { LocalMediaFiles } from "../mediaState";

const owners = new WeakMap<HTMLElement, LocalMediaFiles>();
export function mediaFiles(owner: HTMLElement): LocalMediaFiles {
    let files = owners.get(owner);
    if (!files) {
        files = new LocalMediaFiles();
        owners.set(owner, files);
    }
    return files;
}
export function releaseMediaFiles(owner: HTMLElement): void {
    owners.get(owner)?.clear();
    owners.delete(owner);
}
