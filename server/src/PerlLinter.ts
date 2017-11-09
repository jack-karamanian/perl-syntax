import * as childProcess from 'child_process';
import { Diagnostic, Range, Position, DiagnosticSeverity } from 'vscode-languageserver';

export class PerlLinter {
    process: childProcess.ChildProcess;
    constructor(private includePath: string[]) {
        this.process = null;
    }

    lint(text: string, callback: (diag: Diagnostic[]) => void) : void {
        const diagnostics: Diagnostic[] = [];

        if (this.process) {
            this.process.kill('SIGINT');
        }

        this.process = childProcess.spawn('perl', ['-Xc']);
        this.process.stdin.write("use strict;use warnings;use experimental qw/smartmatch/;" + text);
        this.process.stdin.end("\x04");
        this.process.stderr.on('data', (lineBuf) => {
            const lineStr: string = lineBuf.toString();
            const lines: string[] = lineStr.split('\n');

            lines.forEach((line, index) => {
                if(line.match(/line (\d*)[\.,]/)) {
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
        this.process.addListener('exit', function(code: number, signal: string) {
            callback(diagnostics);    
        });   
    }

    private extractLineNumber(line: string): number {
        const matches = line.match(/line (\d*)[\.,]/);
        return parseInt(matches[1]);       
    }
}
