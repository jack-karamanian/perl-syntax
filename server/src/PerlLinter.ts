import * as childProcess from 'child_process';
import { Diagnostic, Range, Position, DiagnosticSeverity } from 'vscode-languageserver';

export class PerlLinter {
    constructor(private includePath: string[]) { }

    lint(text: string, callback: (diag: Diagnostic[]) => void) : void {
        const diagnostics: Diagnostic[] = [];

        const process: childProcess.ChildProcess = childProcess.spawn('perl', ['-c', '-e', text]);
        process.stderr.on('data', (lineBuf) => {
            const lineStr: string = lineBuf.toString();
            const lines: string[] = lineStr.split('\n');

            lines.forEach((line, index) => {
                if(line.indexOf('line') != -1) {
                    let lineNum = this.extractLineNumber(line) - 1;
                    if(!isNaN(lineNum)) {
                        const diagnostic: Diagnostic =  Diagnostic.create(Range.create(Position.create(lineNum, 0), Position.create(lineNum, line.length)), line, DiagnosticSeverity.Error);
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
        const matches = line.match(/line (\d*)[\.,]/);
        return parseInt(matches[1]);       
    }
}
