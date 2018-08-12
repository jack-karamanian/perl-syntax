import * as childProcess from 'child_process';
import * as _ from 'lodash';
import { Diagnostic, Range, Position, DiagnosticSeverity } from 'vscode-languageserver';

const LINE_REGEX = /line (\d*)[\.,]/;
const LINE_REGEX_INVERSE = /(line )\d*([\.,])/;

interface DocumentProcess {
    [document: string]: childProcess.ChildProcess;
};

export class PerlLinter {
    private documentProcesses: DocumentProcess;

    constructor(
        public perlExecutable: string,
        public includePaths: string[],
        public perlOptions: string[],
        public prependCode: string[]
    ) {
        this.documentProcesses = {};
    }

    lint(uri: string, text: string, callback: (diag: Diagnostic[]) => void) : void {
        const diagnostics: Diagnostic[] = [];

        let process: childProcess.ChildProcess = this.documentProcesses[uri];

        if (process) {
            process.kill('SIGINT');
        }

        this.documentProcesses[uri] = process = childProcess.spawn(
            this.perlExecutable,
            ['-c', ...this.perlOptions, ...this.includePaths.map(path => '-I' + path)]
        );

        process.stdin.on('error', (err: Error) => {
            if (diagnostics.length === 0) {
                throw new Error(`No diagnostics were produced on perl exit: ${err.message}`);
            }
        });

        process.addListener('exit', function(code: number, signal: string) {
            callback(diagnostics);    
        });   

        process.stderr.on('data', (lineBuf) => {
            const lineStr: string = lineBuf.toString();
            const lines: string[] = lineStr.split('\n');
            let lastErrorLineNum = 0;
            lines.forEach((line, index) => {
                if(line.match(LINE_REGEX)) {
                    const errorLineNum = this.extractLineNumber(line);

                    // Ignore the line of prependCode
                    const normalizedLineNum = errorLineNum - 1;

                    // Convert to 0 based line numbers
                    const documentLineNum = errorLineNum - 2; 
                    if(!isNaN(errorLineNum)) {
                        const diagnostic: Diagnostic = Diagnostic.create(
                            Range.create(
                                Position.create(documentLineNum, 0),
                                Position.create(documentLineNum, line.length)
                            ),
                            this.normalizeErrorLineNumber(line, normalizedLineNum),
                            DiagnosticSeverity.Error
                        );
                        diagnostics.push(diagnostic);
                        lastErrorLineNum = documentLineNum;
                    }
                }    
                if(line.match(/has too many errors\.$/)) {
                    const diagnostic: Diagnostic = Diagnostic.create(
                        Range.create(
                            Position.create(lastErrorLineNum, 0),
                            Position.create(lastErrorLineNum, line.length)
                        ),
                        line,
                        DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                }
            });     
        });
        
        process.stdin.write(this.prependCode.join('') + '\n');
        process.stdin.write(text);
        process.stdin.end("\x04");
    }

    private extractLineNumber(line: string): number {
        const matches = line.match(LINE_REGEX);
        return parseInt(matches[1]);       
    }

    private normalizeErrorLineNumber(line: string, lineNumber: number): string {
        return line.replace(LINE_REGEX_INVERSE, `$1${lineNumber}$2`);
    }
}