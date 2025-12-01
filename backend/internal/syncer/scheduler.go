package syncer

import (
	"context"
	"log/slog"
	"time"

	"github.com/robfig/cron/v3"
)

// Job is a single sync task.
type Job func(context.Context) error

// Scheduler wraps robfig/cron with context helpers.
type Scheduler struct {
	cron   *cron.Cron
	logger *slog.Logger
}

// NewScheduler builds a scheduler with default cron config.
func NewScheduler(logger *slog.Logger) *Scheduler {
	return &Scheduler{
		cron:   cron.New(),
		logger: logger,
	}
}

// Add registers a cron entry with a per-run timeout.
func (s *Scheduler) Add(spec, name string, timeout time.Duration, job Job) error {
	_, err := s.cron.AddFunc(spec, func() {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		if err := job(ctx); err != nil {
			s.logger.Error("sync job failed", "job", name, "err", err)
		} else {
			s.logger.Debug("sync job complete", "job", name)
		}
	})
	return err
}

// Start launches the scheduler.
func (s *Scheduler) Start() {
	s.cron.Start()
}

// Stop halts the scheduler and waits for jobs to finish.
func (s *Scheduler) Stop() context.Context {
	return s.cron.Stop()
}
