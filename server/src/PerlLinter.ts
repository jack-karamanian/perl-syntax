import * as childProcess from 'child_process';
import { Diagnostic, Range, Position, DiagnosticSeverity } from 'vscode-languageserver';

const LINE_REGEX = /line (\d*)[\.,]/;

interface DocumentProcess {
    [document: string]: childProcess.ChildProcess;
};

export class PerlLinter {
    private documentProcesses: DocumentProcess;

    constructor(public includePaths: string[], public perlOptions: string[], public prependCode: string[]) {
        this.documentProcesses = {};
    }

    lint(uri: string, text: string, callback: (diag: Diagnostic[]) => void) : void {
        const diagnostics: Diagnostic[] = [];

        let process: childProcess.ChildProcess = this.documentProcesses[uri];

        if (process) {
            process.kill('SIGINT');
        }

        this.documentProcesses[uri] = process = childProcess.spawn('perl', ['-c', ...this.perlOptions, ...this.includePaths.map(path => '-I' + path)]);
        process.stdin.write(this.prependCode.join('') + text);
        process.stdin.end("\x04");
        process.stderr.on('data', (lineBuf) => {
            const lineStr: string = lineBuf.toString();
            const lines: string[] = lineStr.split('\n');
            lines.forEach((line, index) => {
                if(line.match(LINE_REGEX)) {
                    let lineNum = this.extractLineNumber(line) - 1;
                    if(!isNaN(lineNum)) {
                        const diagnostic: Diagnostic = Diagnostic.create(
                            Range.create(Position.create(lineNum, 0), Position.create(lineNum, line.length)),
                            line,
                            DiagnosticSeverity.Error
                        );
                        diagnostics.push(diagnostic);
                    }
                }    
            });     
        });
        process.addListener('exit', function(code: number, signal: string) {
            callback(diagnostics);    
        });   
    }

    private extractLineNumber(line: string): number {
        const matches = line.match(LINE_REGEX);
        return parseInt(matches[1]);       
    }
}