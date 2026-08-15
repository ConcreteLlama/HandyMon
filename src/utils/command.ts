import { exec } from "child_process";

export const execCommand = async (command: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr.trim()));
            } else {
                resolve(stdout.trim());
            }
        });
    });
}