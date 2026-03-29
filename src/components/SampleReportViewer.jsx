import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, CircularProgress, IconButton } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PDF_URL = '/sample-dd-report.pdf';

export default function SampleReportViewer() {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <Box
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <Document
        file={PDF_URL}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        }
        error={
          <Typography variant="caption" sx={{ color: 'text.secondary', py: 4 }}>
            Sample report not available yet.
          </Typography>
        }
      >
        {containerWidth > 0 && (
          <Page
            pageNumber={pageNumber}
            width={containerWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        )}
      </Document>

      {numPages && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <IconButton
            size="small"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => p - 1)}
            sx={{ color: 'text.secondary' }}
          >
            <NavigateBeforeIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {pageNumber} / {numPages}
          </Typography>
          <IconButton
            size="small"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => p + 1)}
            sx={{ color: 'text.secondary' }}
          >
            <NavigateNextIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
